import uuid
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

markdown_document = """
# Politique de Sécurité Informatique
## 1. Gestion des Mots de Passe
Les mots de passe doivent contenir au minimum 14 caractères, incluant des majuscules, des chiffres et des symboles. Le renouvellement est obligatoire tous les 90 jours pour les comptes administrateurs. En cas de compromission suspectée, la révocation est immédiate.

## 2. Accès Distant (VPN)
Tout accès depuis l'extérieur nécessite l'activation de l'authentification multifacteur (MFA) via une clé matérielle FIDO2. Les connexions depuis des réseaux publics non chiffrés sont bloquées par défaut.
"""

# 1. Découpage de niveau Parent basé sur la structure logique (Titres Markdown)
headers_to_split_on = [("#", "Domaine"), ("##", "Section")]
parent_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on=headers_to_split_on,
    strip_headers=False  # Conserve les titres dans le texte parent pour le LLM
)
parent_docs = parent_splitter.split_text(markdown_document)

# 2. Découpage de niveau Enfant (petits segments précis avec fenêtre glissante)
child_splitter = RecursiveCharacterTextSplitter(
    chunk_size=120,
    chunk_overlap=25,
    separators=["\n\n", "\n", ". ", " ", ""]
)
parent_store: dict[str, dict] = {}
child_index: list[dict] = []
for p_doc in parent_docs:
    parent_id = str(uuid.uuid4())
    parent_store[parent_id] = {
        "content": p_doc.page_content,
        "metadata": p_doc.metadata
    }
    # Construction du fil d'Ariane (Breadcrumb) pour enrichir le vecteur enfant
    breadcrumb = " > ".join(p_doc.metadata.values())
    sub_chunks = child_splitter.split_text(p_doc.page_content)
    for sub in sub_chunks:
        # Le texte indexé contient son contexte hiérarchique
        enriched_child_text = f"[{breadcrumb}] {sub}"
        child_index.append({
            "child_id": str(uuid.uuid4()),
            "text_for_embedding": enriched_child_text,
            "parent_id": parent_id,
            "metadata": p_doc.metadata
        })

# 3. Simulation de la phase de récupération (Small-to-Big Retrieval)
def retrieve_parent_contexts(matched_children: list[dict]) -> list[str]:
    """Déduplique les parent_id et retourne les sections complètes pour le LLM."""
    seen_parents = set()
    final_contexts = []
    for child in matched_children:
        pid = child["parent_id"]
        if pid not in seen_parents:
            seen_parents.add(pid)
            final_contexts.append(parent_store[pid]["content"])
    return final_contexts

# Exemple : si la recherche vectorielle retourne les 2 premiers enfants (issus du même parent)
simulated_hits = child_index[:2]
contexts_for_llm = retrieve_parent_contexts(simulated_hits)

print(f"Parents stockés : {len(parent_store)} | Enfants indexés : {len(child_index)}")
print(f"Enfants matchés : {len(simulated_hits)} -> Parents uniques envoyés au LLM : {len(contexts_for_llm)}")
print("\n--- Contexte Parent envoyé au LLM ---\n", contexts_for_llm[0])
