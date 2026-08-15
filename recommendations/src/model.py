import torch
import torch.nn as nn

from .config import EMB_DIM, MLP_DIMS, MLP_DROPOUT


class NeuMF(nn.Module):
    def __init__(
        self,
        n_users: int,
        n_items: int,
        n_moto_types: int,
        n_categories: int,
        n_user_numeric: int,
        n_item_numeric: int,
        emb_dim: int = EMB_DIM,
    ):
        super().__init__()

        self.user_emb_gmf = nn.Embedding(n_users, emb_dim)
        self.item_emb_gmf = nn.Embedding(n_items, emb_dim)

        self.user_emb_mlp = nn.Embedding(n_users, emb_dim)
        self.item_emb_mlp = nn.Embedding(n_items, emb_dim)

        cat_emb_dim = 8
        self.moto_emb = nn.Embedding(n_moto_types, cat_emb_dim)
        self.cat_emb = nn.Embedding(n_categories, cat_emb_dim)

        self.n_user_numeric = n_user_numeric
        self.n_item_numeric = n_item_numeric

        mlp_in = emb_dim * 2 + cat_emb_dim * 2 + n_user_numeric + n_item_numeric

        layers = []
        for dim in MLP_DIMS:
            layers.append(nn.Linear(mlp_in, dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(MLP_DROPOUT))
            mlp_in = dim
        self.mlp = nn.Sequential(*layers)

        self.out = nn.Linear(emb_dim + MLP_DIMS[-1], 1)

    def _logits(
        self,
        user_ids: torch.Tensor,
        item_ids: torch.Tensor,
        user_ctx: torch.Tensor,
        item_ctx: torch.Tensor,
    ) -> torch.Tensor:
        n_cat_user = 1
        n_cat_item = 1

        n_user_numeric = self.n_user_numeric
        n_item_numeric = self.n_item_numeric

        user_numeric = user_ctx[:, :n_user_numeric]
        user_cat = user_ctx[:, n_user_numeric:].long()
        item_numeric = item_ctx[:, :n_item_numeric]
        item_cat = item_ctx[:, n_item_numeric:].long()

        u_gmf = self.user_emb_gmf(user_ids)
        i_gmf = self.item_emb_gmf(item_ids)
        gmf = u_gmf * i_gmf

        u_mlp = self.user_emb_mlp(user_ids)
        i_mlp = self.item_emb_mlp(item_ids)
        moto = self.moto_emb(user_cat.squeeze(-1))
        cat = self.cat_emb(item_cat.squeeze(-1))

        mlp_input = torch.cat([u_mlp, i_mlp, moto, cat, user_numeric, item_numeric], dim=1)
        mlp_out = self.mlp(mlp_input)

        concat = torch.cat([gmf, mlp_out], dim=1)
        return self.out(concat).squeeze(-1)

    def forward(
        self,
        user_ids: torch.Tensor,
        item_ids: torch.Tensor,
        user_ctx: torch.Tensor,
        item_ctx: torch.Tensor,
    ) -> torch.Tensor:
        return torch.sigmoid(self._logits(user_ids, item_ids, user_ctx, item_ctx))


class PureMLP(nn.Module):
    """MLP puro com side-info: sem embeddings colaborativos de usuário/item.

    Recebe apenas contexto do usuário (tipo de moto, idade) e do item
    (categoria, features numéricas, distância). Serve para medir quanto do
    sinal está nas features de conteúdo — o baseline de generalização.
    """

    def __init__(
        self,
        n_moto_types: int,
        n_categories: int,
        n_user_numeric: int,
        n_item_numeric: int,
    ):
        super().__init__()

        cat_emb_dim = 8
        self.moto_emb = nn.Embedding(n_moto_types, cat_emb_dim)
        self.cat_emb = nn.Embedding(n_categories, cat_emb_dim)

        self.n_user_numeric = n_user_numeric
        self.n_item_numeric = n_item_numeric

        mlp_in = cat_emb_dim * 2 + n_user_numeric + n_item_numeric

        layers = []
        for dim in MLP_DIMS:
            layers.append(nn.Linear(mlp_in, dim))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(MLP_DROPOUT))
            mlp_in = dim
        self.mlp = nn.Sequential(*layers)

        self.out = nn.Linear(MLP_DIMS[-1], 1)

    def _logits(
        self,
        user_ids: torch.Tensor,
        item_ids: torch.Tensor,
        user_ctx: torch.Tensor,
        item_ctx: torch.Tensor,
    ) -> torch.Tensor:
        n_user_numeric = self.n_user_numeric
        n_item_numeric = self.n_item_numeric

        user_numeric = user_ctx[:, :n_user_numeric]
        user_cat = user_ctx[:, n_user_numeric:].long()
        item_numeric = item_ctx[:, :n_item_numeric]
        item_cat = item_ctx[:, n_item_numeric:].long()

        moto = self.moto_emb(user_cat.squeeze(-1))
        cat = self.cat_emb(item_cat.squeeze(-1))

        mlp_input = torch.cat([moto, cat, user_numeric, item_numeric], dim=1)
        mlp_out = self.mlp(mlp_input)
        return self.out(mlp_out).squeeze(-1)

    def forward(
        self,
        user_ids: torch.Tensor,
        item_ids: torch.Tensor,
        user_ctx: torch.Tensor,
        item_ctx: torch.Tensor,
    ) -> torch.Tensor:
        return torch.sigmoid(self._logits(user_ids, item_ids, user_ctx, item_ctx))