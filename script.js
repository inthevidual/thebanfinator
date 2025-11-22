class Banfinator {
    constructor() {
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.splitSlider = document.getElementById('splitSlider');
        this.splitReadout = document.getElementById('splitReadout');
        this.exportBtn = document.getElementById('exportBtn');
        this.bylineInput = document.getElementById('bylineInput');
        this.leftInput = document.getElementById('leftFileInput');
        this.rightInput = document.getElementById('rightFileInput');
        this.images = { left: null, right: null };
        this.ratio = 0.5;
        this.dividerWidth = 10;
        this.canvas.width = 3840;
        this.canvas.height = 2160;
        this.bindEvents();
        this.updateReadout();
        this.updateButtonState();
        this.clearCaches();
        this.draw();
    }

    bindEvents() {
        this.splitSlider.addEventListener('input', (e) => {
            this.ratio = e.target.value / 100;
            this.updateReadout();
            this.draw();
        });

        this.exportBtn.addEventListener('click', () => this.export());

        this.setupDropZone(document.querySelector('[data-side="left"]'), this.leftInput, 'left');
        this.setupDropZone(document.querySelector('[data-side="right"]'), this.rightInput, 'right');

        this.bylineInput.addEventListener('input', () => this.draw());
    }

    clearCaches() {
        try {
            if ('caches' in window) {
                caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
            }
            // Bust any lingering cached data URLs for the current session
            sessionStorage.clear();
        } catch (err) {
            console.warn('Cache clearing skipped', err);
        }
    }

    setupDropZone(zone, input, side) {
        const handleFiles = (files) => {
            const file = files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    this.images[side] = img;
                    zone.classList.add('loaded');
                    this.updateButtonState();
                    this.draw();
                };
                img.src = `${reader.result}#${Date.now()}`; // ensure cache busting per load
            };
            reader.readAsDataURL(file);
        };

        zone.addEventListener('click', () => input.click());
        input.addEventListener('change', (e) => handleFiles(e.target.files));

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            handleFiles(e.dataTransfer.files);
        });
    }

    updateReadout() {
        const leftPercent = Math.round(this.ratio * 100);
        const rightPercent = 100 - leftPercent;
        this.splitReadout.textContent = `${leftPercent}% | ${rightPercent}%`;
    }

    updateButtonState() {
        this.exportBtn.disabled = !(this.images.left && this.images.right);
    }

    draw() {
        const { width, height } = this.canvas;
        this.ctx.fillStyle = '#0b0f17';
        this.ctx.fillRect(0, 0, width, height);

        const dividerX = Math.round(this.ratio * (width - this.dividerWidth));
        const leftRegion = { x: 0, width: dividerX };
        const rightRegion = { x: dividerX + this.dividerWidth, width: width - dividerX - this.dividerWidth };

        this.drawImageToRegion(this.images.left, leftRegion, height);
        this.drawImageToRegion(this.images.right, rightRegion, height);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(dividerX, 0, this.dividerWidth, height);

        this.drawByline(height);
    }

    drawImageToRegion(img, region, canvasHeight) {
        if (!img) return;
        const scale = Math.max(region.width / img.width, canvasHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const dx = region.x + (region.width - drawWidth) / 2;
        const dy = (canvasHeight - drawHeight) / 2;
        this.ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
    }

    drawByline(canvasHeight) {
        const byline = this.bylineInput.value.trim();
        if (!byline) return;

        const padding = 28;
        const barHeight = 72;
        this.ctx.fillStyle = 'rgba(0,0,0,0.55)';
        this.ctx.fillRect(0, canvasHeight - barHeight, this.canvas.width, barHeight);

        this.ctx.font = '32px "Fira Mono", monospace';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(byline, padding, canvasHeight - barHeight / 2);
    }

    export() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        link.download = `banfinator_${timestamp}.jpg`;
        link.href = this.canvas.toDataURL('image/jpeg', 0.95);
        link.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Banfinator();
});
