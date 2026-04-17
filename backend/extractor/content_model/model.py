import torch
import torch.nn as nn


class BlockClassifier(nn.Module):
    """
    Structure-focused block classifier (language-agnostic).
    
    Architecture:
    - Removes text tokenization (language-dependent)
    - Uses ONLY structural HTML features
    - 3 paths: structural features + tag embedding + numeric metrics
    """
    def __init__(
        self,
        vocab_size: int,
        tag_vocab_size: int,
        num_numeric: int,
        num_labels: int,
        token_dim: int = 128,
        tag_dim: int = 32,
        hidden_dim: int = 256,
        dropout: float = 0.3,
    ):
        super().__init__()
        
        # NOTE: vocab_size parameter preserved for backward compatibility
        # but NOT used - we don't tokenize text anymore
        self.vocab_size = vocab_size
        
        # Tag embedding: HTML tags are crucial for structure understanding
        self.tag_embed = nn.Embedding(tag_vocab_size, tag_dim)

        # Structural feature encoder: processes the numeric feature vector
        # This captures: heading/paragraph/list indicators, depth, position,
        # class patterns, media presence, etc - all language-agnostic
        self.struct_encoder = nn.Sequential(
            nn.Linear(num_numeric, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.BatchNorm1d(hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        # Fusion head: combine structural features + tag embedding
        fusion_input_size = (hidden_dim // 2) + tag_dim
        self.head = nn.Sequential(
            nn.Linear(fusion_input_size, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, num_labels),
        )

    def forward(self, token_ids, attn_mask, tag_id, num_feats):
        """
        Forward pass (token_ids/attn_mask preserved for compatibility but unused).
        
        Args:
            token_ids: Ignored (language-agnostic model doesn't use text tokens)
            attn_mask: Ignored
            tag_id: Tag embedding index
            num_feats: Numeric structural features
        """
        # Structural feature processing (main path)
        struct_vec = self.struct_encoder(num_feats)
        
        # Tag embedding
        tag_vec = self.tag_embed(tag_id)
        
        # Fuse structure + tags
        fused = torch.cat([struct_vec, tag_vec], dim=1)
        
        return self.head(fused)
