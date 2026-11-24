"""
1. **Imports et configuration de l'environnement (`import ...` et `load_dotenv()`)**
* Importe `json` pour le formatage SSE, `FastAPI` et `StreamingResponse` pour le streaming HTTP asynchrone, `CORSMiddleware` 
*pour les requêtes inter-origines (CORS) depuis le frontend Next.js, `langchain_google_genai` et `langchain_core.messages` pour 
*les appels de chat à Gemini, ainsi que `pydantic` pour la validation des requêtes.
* `load_dotenv()` charge votre `GOOGLE_API_KEY` depuis le fichier `.env` dans les variables d'environnement afin que 
*`ChatGoogleGenerativeAI` puisse s'authentifier automatiquement.

2. **Configuration de l'application et du CORS (`app = FastAPI()` et `app.add_middleware(...)`)**
* Crée l'instance FastAPI et autorise `http://localhost:3000` (votre frontend Next.js) à envoyer des requêtes `POST` vers le backend 
*sans déclencher d'erreurs CORS dans le navigateur.

3. **Validation des requêtes (`ChatMessage` et `ChatRequest`)**
* `ChatMessage` garantit que chaque élément de `messages` possède un `role` valide (`"user"` ou `"assistant"`) et un `content` de type 
*chaîne de caractères.
* `ChatRequest` accepte un `system_prompt` optionnel (jusqu'à 4 000 caractères) ainsi que `messages`.
* `clean_system_prompt` (`mode="before"`) supprime d'abord les espaces superflus autour du prompt système ;
*`default_if_empty` (`mode="after"`) revient à `"You are a helpful AI assistant."` si l'utilisateur le laisse vide.

4. **Normalisation sécurisée du texte des morceaux (`extract_text`)**
* Les morceaux (*chunks*) diffusés en streaming par LangChain peuvent parfois contenir `chunk.content` sous forme de 
*liste de blocs de contenu plutôt que d'une simple chaîne. `extract_text` gère proprement les chaînes et les listes 
*afin qu'une concaténation de texte ne provoque jamais de `TypeError`.

5. **Conversion des messages et initialisation du modèle (`@app.post("/chat")`)**
* Instancie `ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0.7)` à chaque requête 
*(ce qui permet de gérer proprement des prompts système dynamiques).
* Construit `lc_messages` en commençant par `SystemMessage(content=req.system_prompt)`, 
*suivi des entrées `HumanMessage` et `AIMessage` afin que Gemini voie l'intégralité du contexte de conversation 
*ainsi que le rôle ou les instructions actives.

6. **Générateur de streaming SSE (`event_generator` et `StreamingResponse`)**
* `llm.astream(lc_messages)` produit des morceaux incrémentaux au fur et à mesure que Gemini génère sa réponse.
* Chaque fragment de texte non vide est envoyé sous la forme `data: {"text": "..."}\n\n` (le format standard SSE, délimité par `\n\n`).
* Si une exception survient en cours de streaming, il envoie un événement `error` au format JSON ; dans `finally`, 
*il envoie `data: [DONE]\n\n` pour indiquer au frontend que le flux est terminé.
* `StreamingResponse` définit `media_type="text/event-stream"` ainsi que `Cache-Control: no-cache` 
*et `X-Accel-Buffering: no` afin d'éviter la mise en mémoire tampon intermédiaire.

7. **Démarrage programmatique du serveur (`if __name__ == "__main__":`)**
* Exécute `uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)` lorsque vous lancez `python main.py`, 
*avec rechargement automatique lors des modifications de code en développement.
"""



import json  # Used to serialize SSE payload dictionaries into JSON strings
from typing import List, Literal  # Type hints for lists and allowed string literals
from dotenv import load_dotenv  # Loads environment variables from a .env file
from fastapi import FastAPI  # Main web framework class for creating the API
from fastapi.middleware.cors import CORSMiddleware  # Middleware to allow cross-origin requests from the frontend
from fastapi.responses import StreamingResponse  # Response type that streams chunks over HTTP
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage  # Standardized LangChain message roles #type: ignore
from langchain_google_genai import ChatGoogleGenerativeAI  # LangChain wrapper for Google's Gemini chat models #type: ignore
from pydantic import BaseModel, Field, field_validator  # Data validation and schema modeling library
import uvicorn  # ASGI server used to run the FastAPI application

load_dotenv()  # Reads .env into os.environ (e.g., GOOGLE_API_KEY) before initializing clients

app = FastAPI()  # Instantiates the FastAPI application

app.add_middleware(
    CORSMiddleware,  # Attaches CORS handling to all routes
    allow_origins=["http://localhost:3000"],  # Allows requests only from the Next.js dev server origin
    allow_credentials=True,  # Permits cookies/auth headers in cross-origin requests
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allows all request headers (such as Content-Type)
)


class ChatMessage(BaseModel):  # Schema representing a single message in the conversation history
    role: Literal["user", "assistant"]  # Restricts role strictly to "user" or "assistant"
    content: str  # The text content of the message


class ChatRequest(BaseModel):  # Schema for the incoming POST /chat request body
    system_prompt: str = Field(
        default="You are a helpful AI assistant.", max_length=4000  # Fallback prompt and 4,000-char cap
    )
    messages: List[ChatMessage]  # Ordered list of prior/current conversation turns

    @field_validator("system_prompt", mode="before")  # Runs before Pydantic's standard type/constraint checks
    @classmethod
    def clean_system_prompt(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v  # Trims leading/trailing whitespace if it's a string

    @field_validator("system_prompt", mode="after")  # Runs after standard validation completes
    @classmethod
    def default_if_empty(cls, v: str) -> str:
        return v or "You are a helpful AI assistant."  # Replaces an empty/whitespace-only string with the default


def extract_text(content) -> str:
    """Safely normalize LangChain chunk content (string or list of blocks)."""
    if isinstance(content, str):  # Standard plain-text chunk case
        return content
    if isinstance(content, list):  # Some providers/modes return structured content blocks (e.g., dicts)
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)  # Pulls 'text' field or stringifies block
            for block in content
        )
    return ""  # Fallback if content is None or an unexpected type


@app.post("/chat")  # Registers an HTTP POST endpoint at /chat
async def chat_stream(req: ChatRequest):  # Async route handler receiving validated ChatRequest payload
    llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0.7)  # Initializes Gemini model with moderate creativity

    lc_messages = [SystemMessage(content=req.system_prompt)]  # Starts message list with the custom/default system prompt
    for msg in req.messages:  # Converts each frontend ChatMessage into a LangChain message object
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))  # Maps "user" -> HumanMessage
        else:
            lc_messages.append(AIMessage(content=msg.content))  # Maps "assistant" -> AIMessage

    async def event_generator():  # Async generator yielding Server-Sent Events (SSE) chunks
        try:
            async for chunk in llm.astream(lc_messages):  # Streams response chunks asynchronously from Gemini
                text = extract_text(chunk.content)  # Normalizes chunk.content into a safe string
                if text:  # Only emit a frame if there is non-empty text
                    yield f"data: {json.dumps({'text': text})}\n\n"  # Formats as an SSE data event ending with blank line
        except Exception as e:  # Catches runtime/API/network errors during streaming
            yield f"data: {json.dumps({'error': str(e)})}\n\n"  # Sends error payload over the stream
        finally:  # Always executes when streaming finishes or aborts
            yield "data: [DONE]\n\n"  # Signals stream completion to the frontend client

    return StreamingResponse(
        event_generator(),  # Passes the async generator as the streaming body
        media_type="text/event-stream",  # Required MIME type for Server-Sent Events
        headers={
            "Cache-Control": "no-cache",  # Prevents caching of live stream chunks
            "X-Accel-Buffering": "no",  # Disables response buffering in reverse proxies like Nginx
        },
    )


if __name__ == "__main__":  # Ensures server startup only runs when executing this file directly
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)  # Starts Uvicorn locally on port 8000 with auto-reload