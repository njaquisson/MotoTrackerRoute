import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from src.config import DEVICE, EPOCHS
from src.data import DataModule
from src.model import NeuMF, PureMLP
from src.train import train_model
from src.evaluate import evaluate


def main():
    print("=== Comparativo: NeuMF (NCF + Side-Info) vs PureMLP (Side-Info) ===\n")
    t0 = time.time()

    data = DataModule()
    train_ds, test_df, _, _ = data.build_train_test()
    print(f"usuários: {data.n_users} | itens: {data.n_items} | treino: {len(train_ds)} | teste: {len(test_df)}")

    models = {
        "NeuMF (colab + side-info)": NeuMF(
            n_users=data.n_users,
            n_items=data.n_items,
            n_moto_types=data.n_moto_types,
            n_categories=data.n_categories,
            n_user_numeric=data.n_user_numeric,
            n_item_numeric=data.n_item_numeric,
        ),
        "PureMLP (só side-info)": PureMLP(
            n_moto_types=data.n_moto_types,
            n_categories=data.n_categories,
            n_user_numeric=data.n_user_numeric,
            n_item_numeric=data.n_item_numeric,
        ),
    }

    results = {}
    for name, model in models.items():
        print(f"\n--- {name} ({DEVICE}) ---")
        print(f"parâmetros: {sum(p.numel() for p in model.parameters()):,}")
        t = time.time()
        train_model(model, train_ds, epochs=EPOCHS)
        metrics = evaluate(model, data, test_df)
        results[name] = metrics
        print(f"HR@10   : {metrics['HR@10']:.4f}")
        print(f"NDCG@10 : {metrics['NDCG@10']:.4f}")
        print(f"treino + eval: {time.time() - t:.1f}s")

    print("\n=== Resumo ===")
    print(f"{'modelo':<32} {'HR@10':>8} {'NDCG@10':>8}")
    for name, m in results.items():
        print(f"{name:<32} {m['HR@10']:>8.4f} {m['NDCG@10']:>8.4f}")

    print(f"\ntempo total: {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
