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
        this.ctx.fillStyle = '#0c0e12';
        this.ctx.fillRect(0, 0, width, height);

        const dividerX = Math.round(this.ratio * (width - this.dividerWidth));
        const leftRegion = { x: 0, width: dividerX };
        const rightRegion = { x: dividerX + this.dividerWidth, width: width - dividerX - this.dividerWidth };

        this.drawImageToRegion(this.images.left, leftRegion, height);
        this.drawImageToRegion(this.images.right, rightRegion, height);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(dividerX, 0, this.dividerWidth, height);

    }

    drawImageToRegion(img, region, canvasHeight) {
        if (!img) return;
        const scale = Math.max(region.width / img.width, canvasHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const dx = region.x + (region.width - drawWidth) / 2;
        const dy = (canvasHeight - drawHeight) / 2;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(region.x, 0, region.width, canvasHeight);
        this.ctx.clip();
        this.ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
        this.ctx.restore();
    }

    export() {
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        const byline = this.bylineInput.value.trim();

        const baseDataUrl = this.canvas.toDataURL('image/jpeg', 0.95);
        const finalDataUrl = byline ? this.injectXmpByline(baseDataUrl, byline) : baseDataUrl;

        link.download = `banfinator_${timestamp}.jpg`;
        link.href = finalDataUrl;
        link.click();
    }

    injectXmpByline(dataUrl, byline) {
        const jpegBytes = this.dataURLToUint8Array(dataUrl);
        const segments = this.splitJpegSegments(jpegBytes);

        const xmpPacket = this.buildXmpPacket(byline);
        const xmpSegment = this.buildApp1Segment(xmpPacket);
        const xmpIdentifier = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0');

        const filteredSegments = segments.filter((segment) => {
            if (segment[0] !== 0xff || segment[1] !== 0xe1) return true;
            const length = (segment[2] << 8) + segment[3];
            const content = segment.slice(4, 4 + length - 2);
            return !this.startsWithArray(content, xmpIdentifier);
        });

        filteredSegments.splice(1, 0, xmpSegment);
        const merged = this.mergeSegments(filteredSegments);
        return this.uint8ArrayToDataURL(merged);
    }

    buildXmpPacket(byline) {
        const escaped = this.escapeXml(byline);
        return (
            `<?xpacket begin='\ufeff' id='W5M0MpCehiHzreSzNTczkc9d'?>\n` +
            `<x:xmpmeta xmlns:x='adobe:ns:meta/'>\n` +
            `<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>\n` +
            `<rdf:Description xmlns:dc='http://purl.org/dc/elements/1.1/'>\n` +
            `<dc:creator><rdf:Seq><rdf:li>${escaped}</rdf:li></rdf:Seq></dc:creator>\n` +
            `<dc:description><rdf:Alt><rdf:li xml:lang='x-default'>${escaped}</rdf:li></rdf:Alt></dc:description>\n` +
            `</rdf:Description>\n` +
            `</rdf:RDF>\n` +
            `</x:xmpmeta>\n` +
            `<?xpacket end='w'?>`
        );
    }

    buildApp1Segment(xmpPacket) {
        const encoder = new TextEncoder();
        const identifier = encoder.encode('http://ns.adobe.com/xap/1.0/\0');
        const xmpData = encoder.encode(xmpPacket);
        const contentLength = identifier.length + xmpData.length;
        const totalLength = contentLength + 2; // length bytes count themselves

        const segment = new Uint8Array(4 + contentLength);
        segment[0] = 0xff; segment[1] = 0xe1;
        segment[2] = (totalLength >> 8) & 0xff;
        segment[3] = totalLength & 0xff;
        segment.set(identifier, 4);
        segment.set(xmpData, 4 + identifier.length);
        return segment;
    }

    splitJpegSegments(bytes) {
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
            throw new Error('Invalid JPEG data');
        }

        const segments = [bytes.slice(0, 2)];
        let offset = 2;

        while (offset < bytes.length) {
            if (bytes[offset] !== 0xff) break;
            const marker = bytes[offset + 1];
            if (marker === 0xda) { // SOS
                segments.push(bytes.slice(offset));
                break;
            }

            const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
            const end = offset + 2 + length;
            segments.push(bytes.slice(offset, end));
            offset = end;
        }

        return segments;
    }

    mergeSegments(segments) {
        const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        segments.forEach((seg) => {
            merged.set(seg, offset);
            offset += seg.length;
        });
        return merged;
    }

    dataURLToUint8Array(dataUrl) {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    uint8ArrayToDataURL(bytes) {
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        return `data:image/jpeg;base64,${base64}`;
    }

    startsWithArray(buffer, prefix) {
        if (buffer.length < prefix.length) return false;
        for (let i = 0; i < prefix.length; i++) {
            if (buffer[i] !== prefix[i]) return false;
        }
        return true;
    }

    escapeXml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Banfinator();
});
