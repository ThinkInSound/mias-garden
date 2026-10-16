"""Mia's Garden desktop UI (PySide6).

  pip install PySide6
  python3 -m garden.app
"""
from __future__ import annotations

import random
import sys
import tempfile
import threading
from pathlib import Path

from PySide6.QtCore import QObject, Qt, Signal
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import (QApplication, QHBoxLayout, QLabel, QPushButton, QSlider,
                               QVBoxLayout, QWidget)

from . import bridge

STYLE = """
QWidget { background: #F4F1EA; color: #5B4636; font-family: 'Baskerville', 'Georgia', serif; }
QLabel#title { font-size: 26px; font-style: italic; color: #2F4A36; }
QLabel#caption { font-size: 15px; }
QLabel#plate { background: #EADCC9; }
QSlider::groove:horizontal { height: 4px; background: #D9BF86; border-radius: 2px; }
QSlider::handle:horizontal { width: 16px; margin: -7px 0; border-radius: 8px;
                             background: #C48B8B; border: 2px solid #B08D57; }
QPushButton { background: #EADCC9; border: 1px solid #B08D57; padding: 8px 14px; font-size: 14px; }
QPushButton:hover { background: #E8C9C3; }
QPushButton:disabled { color: #A89A8A; }
"""

SLIDERS = (
    ("whisper_of_roses", "The Whisper of Roses", True),
    ("abundance_of_lilies", "Abundance of Lilies", True),
    ("stature_of_bloom", "Stature of the Bloom", False),  # redraw only, no new solve
)


class Worker(QObject):
    done = Signal(object, str)   # grid, png path
    failed = Signal(str)


class GardenWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Mia's Garden")
        self.poetics = bridge.Poetics()
        self.grid = None
        self.seed = random.randrange(1 << 30)
        self.out = Path(tempfile.gettempdir()) / "mias_garden_preview.png"
        self.worker = Worker()
        self.worker.done.connect(self._show)
        self.worker.failed.connect(lambda msg: self.status.setText(msg))

        controls = QVBoxLayout()
        title = QLabel("Mia's Garden"); title.setObjectName("title")
        controls.addWidget(title)
        for field, caption, resolve in SLIDERS:
            label = QLabel(caption); label.setObjectName("caption")
            slider = QSlider(Qt.Horizontal)
            slider.setRange(0, 100)
            slider.setValue(int(getattr(self.poetics, field)))
            slider.sliderReleased.connect(lambda f=field, s=slider, r=resolve: self._changed(f, s.value(), r))
            controls.addWidget(label)
            controls.addWidget(slider)
        self.sow = QPushButton("Sow anew")
        self.sow.clicked.connect(self._reseed)
        controls.addWidget(self.sow)
        self.status = QLabel("")
        controls.addWidget(self.status)
        controls.addStretch()

        self.plate = QLabel(); self.plate.setObjectName("plate")
        self.plate.setAlignment(Qt.AlignCenter)
        self.plate.setMinimumSize(560, 560)

        layout = QHBoxLayout(self)
        panel = QWidget(); panel.setLayout(controls); panel.setFixedWidth(260)
        layout.addWidget(panel)
        layout.addWidget(self.plate, 1)
        self._grow(resolve=True)

    def _changed(self, field, value, resolve):
        setattr(self.poetics, field, float(value))
        self._grow(resolve)

    def _reseed(self):
        self.seed = random.randrange(1 << 30)
        self._grow(resolve=True)

    def _grow(self, resolve: bool):
        self.sow.setEnabled(False)
        self.status.setText("The garden is growing…" if resolve or self.grid is None else "Redrawing…")
        p = bridge.Poetics(**vars(self.poetics))
        grid, seed = (None if resolve else self.grid), self.seed

        def job():
            try:
                g = grid or bridge.solve(p, seed=seed)
                self.worker.done.emit(g, str(bridge.render(g, p, self.out)))
            except Exception as e:  # surface solver/build errors in the window
                self.worker.failed.emit(f"Could not grow: {e}")

        threading.Thread(target=job, daemon=True).start()

    def _show(self, grid, path):
        self.grid = grid
        self.sow.setEnabled(True)
        self.status.setText("")
        pix = QPixmap(path)
        self.plate.setPixmap(pix.scaled(self.plate.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation))


def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(STYLE)
    w = GardenWindow()
    w.resize(900, 640)
    w.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
