import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.config import DEVICE
from src.data import DataModule
from src.model import NeuMF
from src.train import train_model
from src.evaluate import evaluate


def main():
    print("=== MotoTracker — NCF com Side-Info ===")
    t0 = time.time()

    data = DataModule()
    print(f"usuários: {data.n_users} | itens: {data.n_items} | categorias moto: {data.n_moto_types} | categorias destino: {data.n_categories}")

    train_ds, test_df, _, _ = data.build_train_test()
    print(f"treino: {len(train_ds)} | teste (leave-one-out): {len(test_df)}")

    model = NeuMF(
        n_users=data.n_users,
        n_items=data.n_items,
        n_moto_types=data.n_moto_types,
        n_categories=data.n_categories,
        n_user_numeric=data.n_user_numeric,
        n_item_numeric=data.n_item_numeric,
    )
    print(f"modelo NeuMF em {DEVICE}\n")

    train_model(model, train_ds)

    print("\n=== Avaliação Leave-One-Out ===")
    metrics = evaluate(model, data, test_df)
    print(f"usuários avaliados: {metrics['n_users']}")
    print(f"HR@10   : {metrics['HR@10']:.4f}")
    print(f"NDCG@10 : {metrics['NDCG@10']:.4f}")

    print(f"\ntempo total: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()