import pandas as pd
import numpy as np
import random
import uuid
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

N_USERS = 5000
N_ITEMS = 3000
N_INTERACTIONS = 50000

STAY_TIME_THRESHOLD_MIN = 30
REPETITION_WINDOW_DAYS = 90

tipos_moto = ['Speed', 'BigTrail', 'Custom', 'BaixaCilindrada']
probs_moto = [0.25, 0.30, 0.20, 0.25]

user_ids = [str(uuid.uuid4()) for _ in range(N_USERS)]
user_types = np.random.choice(tipos_moto, size=N_USERS, p=probs_moto)
user_ages = np.random.randint(18, 65, size=N_USERS)
user_sex = np.random.choice(['M', 'F', 'Outro'], size=N_USERS, p=[0.75, 0.23, 0.02])

h3_bases = [f"88a83144{i:05x}" for i in range(100)]
user_h3_bases = np.random.choice(h3_bases, size=N_USERS)

df_users = pd.DataFrame({
    'user_id': user_ids,
    'idade': user_ages,
    'sexo': user_sex,
    'tipo_moto': user_types,
    'h3_base_home': user_h3_bases
})

categorias_destino = ['Serra', 'Litoral', 'Mirante', 'Gastronomico', 'Urbano', 'Historico']
item_ids = [f"DEST_REGIONAL_{i:04d}" for i in range(1, N_ITEMS + 1)]
item_h3_centers = [f"88a83145{i:05x}" for i in range(N_ITEMS)]

df_items = pd.DataFrame({
    'item_id': item_ids,
    'catalog_version': 'v1.0',
    'h3_center': item_h3_centers,
    'nome_regiao': [f"Ponto de Encontro {i}" for i in range(1, N_ITEMS + 1)],
    'indice_sinuosidade': np.round(np.random.uniform(1.0, 1.8, size=N_ITEMS), 2),
    'pct_asfalto': np.round(np.random.uniform(0.2, 1.0, size=N_ITEMS), 2),
    'variancia_elevacao': np.random.randint(50, 1500, size=N_ITEMS),
    'categoria_destino': np.random.choice(categorias_destino, size=N_ITEMS)
})
df_items['pct_terra'] = np.round(1.0 - df_items['pct_asfalto'], 2)

user_lookup = df_users.set_index('user_id').to_dict(orient='index')
item_lookup = df_items.set_index('item_id').to_dict(orient='index')

interactions = []

for _ in range(N_INTERACTIONS):
    uid = random.choice(user_ids)
    iid = random.choice(item_ids)

    user_info = user_lookup[uid]
    item_info = item_lookup[iid]

    tipo_moto = user_info['tipo_moto']

    if tipo_moto == 'BaixaCilindrada':
        distancia_km = np.random.uniform(5, 120)
    elif tipo_moto == 'Speed':
        distancia_km = np.random.uniform(30, 250)
    elif tipo_moto == 'Custom':
        distancia_km = np.random.uniform(40, 280)
    else:
        distancia_km = np.random.uniform(50, 450)

    score_afinidade = 0.15

    if tipo_moto == 'BigTrail':
        if item_info['pct_terra'] > 0.40 and item_info['variancia_elevacao'] > 700:
            score_afinidade += 0.65
    elif tipo_moto == 'Speed':
        if item_info['pct_asfalto'] > 0.75 and item_info['indice_sinuosidade'] > 1.15:
            score_afinidade += 0.65
    elif tipo_moto == 'Custom':
        if item_info['categoria_destino'] in ['Gastronomico', 'Historico'] and item_info['indice_sinuosidade'] < 1.50:
            score_afinidade += 0.65
    elif tipo_moto == 'BaixaCilindrada':
        if distancia_km <= 80:
            score_afinidade += 0.65
        else:
            score_afinidade -= 0.5

    prob_sucesso = np.clip(score_afinidade, 0.05, 0.95)

    target = 1 if random.random() < prob_sucesso else 0

    tempo_parada_min = np.random.randint(35, 180) if target == 1 else np.random.randint(0, 25)
    repeticoes_mes = np.random.poisson(lam=1.5) if target == 1 else 0

    if target == 1:
        weight = 1.0 + (tempo_parada_min / 60.0) * 0.2 + (repeticoes_mes * 0.3)
    else:
        weight = 1.0

    interactions.append({
        'trip_id': str(uuid.uuid4()),
        'user_id': uid,
        'item_id': iid,
        'distancia_total_km': np.round(distancia_km, 2),
        'target': target,
        'sample_weight': np.round(weight, 2)
    })

df_interactions = pd.DataFrame(interactions)

DATA_DIR.mkdir(parents=True, exist_ok=True)
df_users.to_csv(DATA_DIR / "users.csv", index=False)
df_items.to_csv(DATA_DIR / "items.csv", index=False)
df_interactions.to_csv(DATA_DIR / "interactions.csv", index=False)

print(f"Dataset sintético gerado com sucesso em '{DATA_DIR}'!")
print(f"- {len(df_users)} usuários salvos em 'users.csv'")
print(f"- {len(df_items)} itens salvos em 'items.csv'")
print(f"- {len(df_interactions)} interações salvos em 'interactions.csv'")
print(f"Taxa de viagens positivas (target=1): {df_interactions['target'].mean():.2%}")
