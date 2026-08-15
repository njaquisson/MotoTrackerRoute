import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from .config import BATCH_SIZE, LEARNING_RATE, EPOCHS, DEVICE


def train_model(
    model: nn.Module,
    dataset,
    epochs: int = EPOCHS,
    lr: float = LEARNING_RATE,
    use_scheduler: bool = False,
) -> list[float]:
    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = (
        torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
        if use_scheduler
        else None
    )
    loss_fn = nn.BCEWithLogitsLoss(reduction="none")
    model.to(DEVICE)
    model.train()

    epoch_losses = []

    for epoch in range(epochs):
        total_loss = 0.0
        n_batches = 0
        for user_ids, item_ids, user_ctx, item_ctx, targets, weights in loader:
            user_ids = user_ids.to(DEVICE)
            item_ids = item_ids.to(DEVICE)
            user_ctx = user_ctx.to(DEVICE)
            item_ctx = item_ctx.to(DEVICE)
            targets = targets.to(DEVICE)
            weights = weights.to(DEVICE)

            optimizer.zero_grad()
            logits = model._logits(user_ids, item_ids, user_ctx, item_ctx)
            loss = loss_fn(logits, targets)
            loss = (loss * weights).mean()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            n_batches += 1

        if scheduler is not None:
            scheduler.step()

        epoch_losses.append(total_loss / n_batches)
        if (epoch + 1) % 10 == 0 or epochs <= 30:
            print(f"  epoch {epoch + 1:02d}/{epochs:02d} | loss {total_loss / n_batches:.4f}")

    return epoch_losses


def predict(model: nn.Module, user_ids, item_ids, user_ctx, item_ctx) -> torch.Tensor:
    model.eval()
    with torch.no_grad():
        return model(user_ids, item_ids, user_ctx, item_ctx)