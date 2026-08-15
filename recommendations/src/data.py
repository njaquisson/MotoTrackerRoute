import pandas as pd
import numpy as np
import torch
from torch.utils.data import Dataset

from .config import (
    USERS_CSV,
    ITEMS_CSV,
    INTERACTIONS_CSV,
    USER_CONTEXT_NUMERIC,
    ITEM_CONTEXT_NUMERIC,
    USER_CONTEXT_CAT,
    ITEM_CONTEXT_CAT,
    DISTANCE_FEATURE,
    RANDOM_SEED,
)


def encode_categories(series: pd.Series) -> tuple[dict[str, int], int]:
    cats = sorted(series.dropna().unique().tolist())
    mapping = {c: i for i, c in enumerate(cats)}
    return mapping, len(cats)


def normalize_series(series: pd.Series) -> np.ndarray:
    arr = series.astype(np.float64).to_numpy()
    mean = arr.mean()
    std = arr.std()
    if std == 0:
        return np.zeros_like(arr)
    return (arr - mean) / std


class NCFDataset(Dataset):
    def __init__(
        self,
        users: np.ndarray,
        items: np.ndarray,
        user_ctx: np.ndarray,
        item_ctx: np.ndarray,
        targets: np.ndarray,
        weights: np.ndarray,
    ):
        self.users = torch.tensor(users, dtype=torch.long)
        self.items = torch.tensor(items, dtype=torch.long)
        self.user_ctx = torch.tensor(user_ctx, dtype=torch.float32)
        self.item_ctx = torch.tensor(item_ctx, dtype=torch.float32)
        self.targets = torch.tensor(targets, dtype=torch.float32)
        self.weights = torch.tensor(weights, dtype=torch.float32)

    def __len__(self) -> int:
        return len(self.users)

    def __getitem__(self, idx: int):
        return (
            self.users[idx],
            self.items[idx],
            self.user_ctx[idx],
            self.item_ctx[idx],
            self.targets[idx],
            self.weights[idx],
        )


class DataModule:
    def __init__(self):
        self.users_df = pd.read_csv(USERS_CSV)
        self.items_df = pd.read_csv(ITEMS_CSV)
        self.interactions_df = pd.read_csv(INTERACTIONS_CSV)

        self.user_id2idx: dict[str, int] = {
            uid: i for i, uid in enumerate(self.users_df["user_id"])
        }
        self.item_id2idx: dict[str, int] = {
            iid: i for i, iid in enumerate(self.items_df["item_id"])
        }

        self.tipo_moto_map, self.n_moto_types = encode_categories(self.users_df["tipo_moto"])
        self.cat_map, self.n_categories = encode_categories(self.items_df["categoria_destino"])

        self._user_by_id = self.users_df.set_index("user_id")
        self._item_by_id = self.items_df.set_index("item_id")

        self.n_users = len(self.user_id2idx)
        self.n_items = len(self.item_id2idx)
        self.n_user_numeric = len(USER_CONTEXT_NUMERIC)
        self.n_item_numeric = len(ITEM_CONTEXT_NUMERIC) + 1

        self._prepare_normalization()

    def _prepare_normalization(self):
        self.user_num_stats = {}
        for col in USER_CONTEXT_NUMERIC:
            arr = self.users_df[col].astype(np.float64).to_numpy()
            self.user_num_stats[col] = (arr.mean(), arr.std() if arr.std() > 0 else 1.0)
        self.item_num_stats = {}
        for col in ITEM_CONTEXT_NUMERIC:
            arr = self.items_df[col].astype(np.float64).to_numpy()
            self.item_num_stats[col] = (arr.mean(), arr.std() if arr.std() > 0 else 1.0)
        arr = self.interactions_df[DISTANCE_FEATURE].astype(np.float64).to_numpy()
        self.distance_stats = (arr.mean(), arr.std() if arr.std() > 0 else 1.0)

    def user_context(self, user_ids: list[str]) -> np.ndarray:
        df = self._user_by_id.loc[user_ids]
        numeric_cols = []
        for col in USER_CONTEXT_NUMERIC:
            mean, std = self.user_num_stats[col]
            numeric_cols.append(((df[col].astype(np.float64) - mean) / std).to_numpy(dtype=np.float32))
        cats = np.asarray([self.tipo_moto_map[v] for v in df["tipo_moto"]], dtype=np.float32)
        return np.column_stack(numeric_cols + [cats])

    def item_context(self, item_ids: list[str], distances: np.ndarray | None = None) -> np.ndarray:
        df = self._item_by_id.loc[item_ids]
        numeric_cols = []
        for col in ITEM_CONTEXT_NUMERIC:
            mean, std = self.item_num_stats[col]
            numeric_cols.append(((df[col].astype(np.float64) - mean) / std).to_numpy(dtype=np.float32))
        if distances is not None:
            mean_d, std_d = self.distance_stats
            numeric_cols.append(((distances - mean_d) / std_d).astype(np.float32))
        else:
            numeric_cols.append(np.zeros(len(item_ids), dtype=np.float32))
        cats = np.asarray([self.cat_map[v] for v in df["categoria_destino"]], dtype=np.float32)
        return np.column_stack(numeric_cols + [cats])

    def build_train_test(self):
        positives = self.interactions_df[self.interactions_df["target"] == 1]
        pick_idx = positives.groupby("user_id").apply(
            lambda g: g.sample(n=1, random_state=RANDOM_SEED).index[0]
        )
        test_mask = self.interactions_df.index.isin(pick_idx.values)

        train_df = self.interactions_df[~test_mask]
        test_df = self.interactions_df[test_mask].copy()

        test_dist = test_df["distancia_total_km"].to_numpy(dtype=np.float64)

        train_user_ctx = self.user_context(train_df["user_id"].tolist())
        train_item_ctx = self.item_context(
            train_df["item_id"].tolist(), train_df["distancia_total_km"].to_numpy(dtype=np.float64)
        )

        train = NCFDataset(
            users=np.array([self.user_id2idx[u] for u in train_df["user_id"]]),
            items=np.array([self.item_id2idx[i] for i in train_df["item_id"]]),
            user_ctx=train_user_ctx,
            item_ctx=train_item_ctx,
            targets=train_df["target"].to_numpy(dtype=np.float32),
            weights=train_df["sample_weight"].to_numpy(dtype=np.float32),
        )

        test_user_ctx = self.user_context(test_df["user_id"].tolist())
        test_item_ctx = self.item_context(test_df["item_id"].tolist(), test_dist)

        return train, test_df, test_user_ctx, test_item_ctx

    def sample_negatives_for_user(self, user_id: str, excluded_items: set[str], k: int) -> list[str]:
        rng = np.random.default_rng(RANDOM_SEED + sum(ord(c) for c in user_id))
        available = [i for i in self.item_id2idx if i not in excluded_items]
        chosen = rng.choice(available, size=min(k, len(available)), replace=False)
        return list(chosen)

    def candidate_distances(self, user_id: str, item_ids: list[str]) -> np.ndarray:
        moto = self.users_df.set_index("user_id").loc[user_id, "tipo_moto"]
        rng = np.random.default_rng(RANDOM_SEED + sum(ord(c) for c in user_id))
        if moto == "BaixaCilindrada":
            lo, hi = 5, 120
        elif moto == "Speed":
            lo, hi = 30, 250
        elif moto == "Custom":
            lo, hi = 40, 280
        else:
            lo, hi = 50, 450
        return rng.uniform(lo, hi, size=len(item_ids))