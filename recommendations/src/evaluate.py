import numpy as np
import pandas as pd
import torch

from .config import EVAL_K, NEG_SAMPLES_EVAL, DEVICE
from .data import DataModule
from .model import NeuMF


def hit_rate_at_k(rank: int, k: int) -> float:
    return 1.0 if rank <= k else 0.0


def ndcg_at_k(rank: int, k: int) -> float:
    if rank <= k:
        return 1.0 / np.log2(rank + 1)
    return 0.0


def evaluate(model: NeuMF, data: DataModule, test_df: pd.DataFrame) -> dict:
    model.to(DEVICE)
    model.eval()

    hr_sum = 0.0
    ndcg_sum = 0.0
    n_users = 0

    interactions_by_user = {
        uid: set(g["item_id"].tolist())
        for uid, g in data.interactions_df.groupby("user_id")
    }

    with torch.no_grad():
        for uid, group in test_df.groupby("user_id"):
            item_positive = group["item_id"].iloc[0]
            excluded = interactions_by_user[uid]

            negatives = data.sample_negatives_for_user(uid, excluded, NEG_SAMPLES_EVAL)

            candidate_items = [item_positive] + negatives
            item_ids = torch.tensor(
                [data.item_id2idx[i] for i in candidate_items], dtype=torch.long
            ).to(DEVICE)
            user_ids = torch.full(
                (len(candidate_items),), data.user_id2idx[uid], dtype=torch.long
            ).to(DEVICE)

            distances = data.candidate_distances(uid, candidate_items)
            distances[0] = group["distancia_total_km"].iloc[0]

            user_ctx = data.user_context([uid] * len(candidate_items))
            item_ctx = data.item_context(candidate_items, distances)
            user_ctx = torch.tensor(user_ctx, dtype=torch.float32).to(DEVICE)
            item_ctx = torch.tensor(item_ctx, dtype=torch.float32).to(DEVICE)

            scores = model(user_ids, item_ids, user_ctx, item_ctx).cpu().numpy()
            rank_of_positive = int(np.argsort(-scores).tolist().index(0)) + 1

            hr_sum += hit_rate_at_k(rank_of_positive, EVAL_K)
            ndcg_sum += ndcg_at_k(rank_of_positive, EVAL_K)
            n_users += 1

    return {
        "n_users": n_users,
        f"HR@{EVAL_K}": hr_sum / n_users if n_users else 0.0,
        f"NDCG@{EVAL_K}": ndcg_sum / n_users if n_users else 0.0,
    }