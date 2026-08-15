from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
USERS_CSV = DATA_DIR / "users.csv"
ITEMS_CSV = DATA_DIR / "items.csv"
INTERACTIONS_CSV = DATA_DIR / "interactions.csv"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"

RANDOM_SEED = 42

EMB_DIM = 32
MLP_DIMS = [128, 64, 32]
MLP_DROPOUT = 0.2

BATCH_SIZE = 1024
LEARNING_RATE = 1e-3
EPOCHS = 30

EVAL_K = 10
NEG_SAMPLES_EVAL = 100

DEVICE = "cpu"

USER_CONTEXT_NUMERIC = ["idade"]
ITEM_CONTEXT_NUMERIC = ["indice_sinuosidade", "pct_asfalto", "variancia_elevacao"]
USER_CONTEXT_CAT = ["tipo_moto"]
ITEM_CONTEXT_CAT = ["categoria_destino"]
DISTANCE_FEATURE = "distancia_total_km"