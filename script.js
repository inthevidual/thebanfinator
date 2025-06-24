class ImageCombiner {
    constructor() {
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.leftImage = null;
        this.rightImage = null;
        this.leftImageData = { x: 0, y: 0, width: 0, height: 0, scale: 1, originalWidth: 0, originalHeight: 0 };
        this.rightImageData = { x: 1510, y: 0, width: 0, height: 0, scale: 1, originalWidth: 0, originalHeight: 0 };
        this.isDragging = false;
        this.isResizing = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.currentImageSide = null;
        this.resizeHandle = null;
        this.selectedImage = null;
        this.resizeStartData = null;
        this.leftCopyright = '';
        this.rightCopyright = '';
        
        this.initializeCanvas();
        this.setupEventListeners();
        this.drawCanvas();
    }
    
    initializeCanvas() {
        // Scale canvas for display
        this.canvas.style.width = '100%';
        this.canvas.style.height = 'auto';
        this.canvas.style.maxWidth = '900px';
    }
    
    setupEventListeners() {
        // File input handlers
        $('#leftFileInput').on('change', (e) => this.handleFileSelect(e, 'left'));
        $('#rightFileInput').on('change', (e) => this.handleFileSelect(e, 'right'));
        
        // Drop zone handlers
        this.setupDropZone('#leftDropZone', '#leftFileInput', 'left');
        this.setupDropZone('#rightDropZone', '#rightFileInput', 'right');
        
        // Canvas interaction
        $(this.canvas).on('mousedown', (e) => this.handleMouseDown(e));
        $(this.canvas).on('mousemove', (e) => this.handleMouseMove(e));
        $(this.canvas).on('mouseup', () => this.handleMouseUp());
        $(this.canvas).on('mouseleave', () => this.handleMouseUp()); // Stop resize/drag when leaving canvas
        $(this.canvas).on('click', (e) => this.handleCanvasClick(e));
        
        // Wheel zoom - no constraints
        $(this.canvas).on('wheel', (e) => this.handleWheel(e));
        
        // Control buttons
        $('#switchBtn').on('click', () => this.switchImages());
        $('#exportBtn').on('click', () => this.exportImage());
        
        // Scale sliders
        $('#leftScaleSlider').on('input', (e) => this.handleScaleSlider(e, 'left'));
        $('#rightScaleSlider').on('input', (e) => this.handleScaleSlider(e, 'right'));
        
        // Directional controls
        $('.dir-btn').on('click', (e) => this.handleDirectionalControl(e));
    }
    
    setupDropZone(zoneSelector, inputSelector, side) {
        const zone = $(zoneSelector);
        const input = $(inputSelector);
        
        zone.on('click', () => input.click());
        
        zone.on('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.addClass('dragover');
        });
        
        zone.on('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.addClass('dragover');
        });
        
        zone.on('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Only remove dragover if we're actually leaving the drop zone
            if (!zone[0].contains(e.relatedTarget)) {
                zone.removeClass('dragover');
            }
        });
        
        zone.on('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zone.removeClass('dragover');
            
            const files = e.originalEvent.dataTransfer.files;
            if (files.length > 0) {
                this.loadImage(files[0], side);
            }
        });
    }
    
    handleFileSelect(event, side) {
        const file = event.target.files[0];
        if (file) {
            this.loadImage(file, side);
        }
    }
    
    loadImage(file, side) {
        if (!file.type.match('image/jpeg') && !file.type.match('image/jpg')) {
            alert('Vänligen välj en JPG-bildfil.');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.processImage(img, file, side);
                this.extractIPTC(file, side);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    processImage(img, file, side) {
        const imageData = side === 'left' ? this.leftImageData : this.rightImageData;
        const maxWidth = 1490; // Half canvas minus divider
        const maxHeight = 2000;
        
        // Calculate scale to fill the entire half (center crop)
        const scaleToFillWidth = maxWidth / img.width;
        const scaleToFillHeight = maxHeight / img.height;
        const scale = Math.max(scaleToFillWidth, scaleToFillHeight); // Use max for center crop
        
        imageData.originalWidth = img.width;
        imageData.originalHeight = img.height;
        imageData.width = img.width * scale;
        imageData.height = img.height * scale;
        imageData.scale = scale;
        
        // Center the image in its half
        if (side === 'left') {
            imageData.x = (1490 - imageData.width) / 2;
            this.leftImage = img;
            $('#leftDropZone').addClass('has-image');
            $('#leftImageName').text(file.name);
            $('#leftImageDimensions').text(`${img.width} × ${img.height}`);
            $('#leftImageInfo').show();
            $('#leftControls').show();
        } else {
            imageData.x = 1510 + (1490 - imageData.width) / 2;
            this.rightImage = img;
            $('#rightDropZone').addClass('has-image');
            $('#rightImageName').text(file.name);
            $('#rightImageDimensions').text(`${img.width} × ${img.height}`);
            $('#rightImageInfo').show();
            $('#rightControls').show();
        }
        
        imageData.y = (maxHeight - imageData.height) / 2;
        
        // Update scale slider
        const scalePercent = Math.round(scale * 100);
        if (side === 'left') {
            $('#leftScaleSlider').val(scalePercent);
            $('#leftScaleValue').text(scalePercent + '%');
        } else {
            $('#rightScaleSlider').val(scalePercent);
            $('#rightScaleValue').text(scalePercent + '%');
        }
        
        this.updateControls();
        this.drawCanvas();
    }
    
    extractIPTC(file, side) {
        EXIF.getData(file, () => {
            // Prioritize Author field, fallback to Copyright if Author is empty/missing
            let author = EXIF.getTag(file, 'Artist') || EXIF.getTag(file, 'Author') || '';
            let copyright = EXIF.getTag(file, 'Copyright') || '';
            
            // Use Author if available, otherwise use Copyright
            const metadataValue = author || copyright;
            
            if (side === 'left') {
                this.leftCopyright = metadataValue;
            } else {
                this.rightCopyright = metadataValue;
            }
            
            this.mergeCopyright();
        });
    }
    
    mergeCopyright() {
        if (!this.leftCopyright && !this.rightCopyright) return;
        
        let merged = '';
        
        if (this.leftCopyright && this.rightCopyright) {
            // Check for common suffixes
            const commonSuffixes = ['/AP', '/TT', '/SvD', '/Getty', '/Reuters'];
            let commonSuffix = '';
            
            for (const suffix of commonSuffixes) {
                if (this.leftCopyright.endsWith(suffix) && this.rightCopyright.endsWith(suffix)) {
                    commonSuffix = suffix;
                    break;
                }
            }
            
            if (commonSuffix) {
                const leftWithoutSuffix = this.leftCopyright.replace(commonSuffix, '');
                const rightWithoutSuffix = this.rightCopyright.replace(commonSuffix, '');
                merged = `${leftWithoutSuffix}/${rightWithoutSuffix}${commonSuffix}`;
            } else {
                merged = `${this.leftCopyright}/${this.rightCopyright}`;
            }
        } else {
            merged = this.leftCopyright || this.rightCopyright;
        }
        
        $('#copyrightField').val(merged);
    }
    
    drawCanvas() {
        this.ctx.clearRect(0, 0, 3000, 2000);
        
        // Draw white background
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, 3000, 2000);
        
        // Draw center divider
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(1490, 0, 20, 2000);
        
        // Set up clipping for left side
        if (this.leftImage) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(0, 0, 1490, 2000);
            this.ctx.clip();
            
            this.ctx.drawImage(
                this.leftImage,
                this.leftImageData.x,
                this.leftImageData.y,
                this.leftImageData.width,
                this.leftImageData.height
            );
            this.ctx.restore();
        }
        
        // Set up clipping for right side
        if (this.rightImage) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(1510, 0, 1490, 2000);
            this.ctx.clip();
            
            this.ctx.drawImage(
                this.rightImage,
                this.rightImageData.x,
                this.rightImageData.y,
                this.rightImageData.width,
                this.rightImageData.height
            );
            this.ctx.restore();
        }
        
        // Draw selection border and handles if an image is selected
        if (this.selectedImage) {
            const imageData = this.selectedImage === 'left' ? this.leftImageData : this.rightImageData;
            this.drawSelectionBorder(imageData);
            this.drawResizeHandles(imageData);
        }
    }
    
    drawSelectionBorder(imageData) {
        // Calculate visible bounds (clipped to canvas regions)
        let visibleX = imageData.x;
        let visibleY = Math.max(0, imageData.y);
        let visibleWidth = imageData.width;
        let visibleHeight = Math.min(imageData.height, 2000 - visibleY);
        
        if (this.selectedImage === 'left') {
            visibleX = Math.max(0, imageData.x);
            visibleWidth = Math.min(imageData.width, 1490 - visibleX);
        } else {
            visibleX = Math.max(1510, imageData.x);
            visibleWidth = Math.min(imageData.width, 3000 - visibleX);
        }
        
        if (visibleWidth > 0 && visibleHeight > 0) {
            this.ctx.strokeStyle = '#007bff';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([8, 4]);
            this.ctx.strokeRect(visibleX, visibleY, visibleWidth, visibleHeight);
            this.ctx.setLineDash([]);
        }
    }
    
    drawResizeHandles(imageData) {
        const handleSize = 10;
        const edgeHandleLength = 25;
        
        // Corner handles
        const corners = [
            { x: imageData.x, y: imageData.y, type: 'top-left' },
            { x: imageData.x + imageData.width, y: imageData.y, type: 'top-right' },
            { x: imageData.x, y: imageData.y + imageData.height, type: 'bottom-left' },
            { x: imageData.x + imageData.width, y: imageData.y + imageData.height, type: 'bottom-right' }
        ];
        
        // Edge handles
        const edges = [
            { x: imageData.x + imageData.width / 2, y: imageData.y, type: 'top', width: edgeHandleLength, height: handleSize },
            { x: imageData.x + imageData.width / 2, y: imageData.y + imageData.height, type: 'bottom', width: edgeHandleLength, height: handleSize },
            { x: imageData.x, y: imageData.y + imageData.height / 2, type: 'left', width: handleSize, height: edgeHandleLength },
            { x: imageData.x + imageData.width, y: imageData.y + imageData.height / 2, type: 'right', width: handleSize, height: edgeHandleLength }
        ];
        
        // Draw corner handles
        corners.forEach(corner => {
            this.drawHandle(corner.x - handleSize/2, corner.y - handleSize/2, handleSize, handleSize);
        });
        
        // Draw edge handles
        edges.forEach(edge => {
            this.drawHandle(edge.x - edge.width/2, edge.y - edge.height/2, edge.width, edge.height);
        });
    }
    
    drawHandle(x, y, width, height) {
        // White border (thicker)
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(x - 4, y - 4, width + 8, height + 8);
        
        // Blue handle (brighter blue)
        this.ctx.fillStyle = '#0066ff';
        this.ctx.fillRect(x, y, width, height);
        
        // Inner highlight for 3D effect
        this.ctx.fillStyle = '#3388ff';
        this.ctx.fillRect(x + 1, y + 1, Math.max(1, width - 2), Math.max(1, height - 2));
        
        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fillRect(x + 2, y + 2, width, height);
        this.ctx.fillStyle = '#0066ff';
        this.ctx.fillRect(x, y, width, height);
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    isPointInImage(x, y, imageData) {
        return x >= imageData.x && x <= imageData.x + imageData.width &&
               y >= imageData.y && y <= imageData.y + imageData.height;
    }
    
    getResizeHandle(x, y, imageData) {
        const handleSize = 20; // Larger hit area for easier grabbing
        const edgeHandleLength = 35;
        
        // Corner handles
        const corners = [
            { x: imageData.x, y: imageData.y, type: 'top-left' },
            { x: imageData.x + imageData.width, y: imageData.y, type: 'top-right' },
            { x: imageData.x, y: imageData.y + imageData.height, type: 'bottom-left' },
            { x: imageData.x + imageData.width, y: imageData.y + imageData.height, type: 'bottom-right' }
        ];
        
        // Check corners first (they have priority)
        for (const corner of corners) {
            if (Math.abs(x - corner.x) <= handleSize && Math.abs(y - corner.y) <= handleSize) {
                return corner.type;
            }
        }
        
        // Edge handles
        const edges = [
            { x: imageData.x + imageData.width / 2, y: imageData.y, type: 'top', width: edgeHandleLength, height: handleSize },
            { x: imageData.x + imageData.width / 2, y: imageData.y + imageData.height, type: 'bottom', width: edgeHandleLength, height: handleSize },
            { x: imageData.x, y: imageData.y + imageData.height / 2, type: 'left', width: handleSize, height: edgeHandleLength },
            { x: imageData.x + imageData.width, y: imageData.y + imageData.height / 2, type: 'right', width: handleSize, height: edgeHandleLength }
        ];
        
        for (const edge of edges) {
            if (Math.abs(x - edge.x) <= edge.width/2 && Math.abs(y - edge.y) <= edge.height/2) {
                return edge.type;
            }
        }
        
        return null;
    }
    
    handleCanvasClick(e) {
        const pos = this.getMousePos(e);
        
        // Determine which side was clicked based on X coordinate
        if (pos.x < 1490) {
            // Left side clicked
            if (this.leftImage) {
                this.selectedImage = 'left';
            } else {
                this.selectedImage = null;
            }
        } else if (pos.x > 1510) {
            // Right side clicked  
            if (this.rightImage) {
                this.selectedImage = 'right';
            } else {
                this.selectedImage = null;
            }
        } else {
            // Clicked on divider
            this.selectedImage = null;
        }
        
        this.drawCanvas();
    }
    
    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        
        // Check for resize handles first (if an image is selected)
        if (this.selectedImage) {
            const imageData = this.selectedImage === 'left' ? this.leftImageData : this.rightImageData;
            const handle = this.getResizeHandle(pos.x, pos.y, imageData);
            
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.currentImageSide = this.selectedImage;
                this.dragStartX = pos.x;
                this.dragStartY = pos.y;
                
                // Store initial state for more controlled resizing
                this.resizeStartData = {
                    x: imageData.x,
                    y: imageData.y,
                    width: imageData.width,
                    height: imageData.height,
                    mouseX: pos.x,
                    mouseY: pos.y
                };
                return;
            }
        }
        
        // Check for dragging based on side of canvas
        if (pos.x < 1490 && this.leftImage) {
            // Left side
            this.currentImageSide = 'left';
            this.selectedImage = 'left';
            this.isDragging = true;
        } else if (pos.x > 1510 && this.rightImage) {
            // Right side
            this.currentImageSide = 'right';
            this.selectedImage = 'right';
            this.isDragging = true;
        } else {
            this.selectedImage = null;
        }
        
        this.dragStartX = pos.x;
        this.dragStartY = pos.y;
        this.drawCanvas();
    }
    
    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        
        // Update cursor based on what's under the mouse
        if (!this.isDragging && !this.isResizing) {
            this.updateCursor(pos);
        }
        
        if (this.isResizing && this.currentImageSide && this.resizeHandle) {
            this.handleResize(pos);
        } else if (this.isDragging && this.currentImageSide) {
            this.handleDrag(pos);
        }
    }
    
    updateCursor(pos) {
        let cursor = 'default';
        
        if (this.selectedImage) {
            const imageData = this.selectedImage === 'left' ? this.leftImageData : this.rightImageData;
            const handle = this.getResizeHandle(pos.x, pos.y, imageData);
            
            if (handle) {
                const cursorMap = {
                    'top-left': 'nw-resize',
                    'top-right': 'ne-resize',
                    'bottom-left': 'sw-resize',
                    'bottom-right': 'se-resize',
                    'top': 'n-resize',
                    'bottom': 's-resize',
                    'left': 'w-resize',
                    'right': 'e-resize'
                };
                cursor = cursorMap[handle];
            } else if (this.isPointInImage(pos.x, pos.y, imageData)) {
                cursor = 'move';
            }
        } else {
            // Check if hovering over any image
            if ((this.leftImage && this.isPointInImage(pos.x, pos.y, this.leftImageData)) ||
                (this.rightImage && this.isPointInImage(pos.x, pos.y, this.rightImageData))) {
                cursor = 'pointer';
            }
        }
        
        this.canvas.style.cursor = cursor;
    }
    
    handleResize(pos) {
        if (!this.resizeStartData) return;
        
        const imageData = this.currentImageSide === 'left' ? this.leftImageData : this.rightImageData;
        
        // Calculate movement delta with reduced sensitivity
        const deltaX = (pos.x - this.resizeStartData.mouseX) * 0.5; // Reduce sensitivity
        const deltaY = (pos.y - this.resizeStartData.mouseY) * 0.5;
        
        // Calculate aspect ratio
        const aspectRatio = imageData.originalWidth / imageData.originalHeight;
        
        let newWidth = this.resizeStartData.width;
        let newHeight = this.resizeStartData.height;
        let newX = this.resizeStartData.x;
        let newY = this.resizeStartData.y;
        
        // Handle different resize directions with more intuitive behavior
        switch (this.resizeHandle) {
            case 'bottom-right':
                newWidth = Math.max(50, this.resizeStartData.width + deltaX);
                newHeight = newWidth / aspectRatio;
                break;
            case 'bottom-left':
                newWidth = Math.max(50, this.resizeStartData.width - deltaX);
                newHeight = newWidth / aspectRatio;
                newX = this.resizeStartData.x + (this.resizeStartData.width - newWidth);
                break;
            case 'top-right':
                newWidth = Math.max(50, this.resizeStartData.width + deltaX);
                newHeight = newWidth / aspectRatio;
                newY = this.resizeStartData.y + (this.resizeStartData.height - newHeight);
                break;
            case 'top-left':
                newWidth = Math.max(50, this.resizeStartData.width - deltaX);
                newHeight = newWidth / aspectRatio;
                newX = this.resizeStartData.x + (this.resizeStartData.width - newWidth);
                newY = this.resizeStartData.y + (this.resizeStartData.height - newHeight);
                break;
            case 'right':
                newWidth = Math.max(50, this.resizeStartData.width + deltaX);
                newHeight = newWidth / aspectRatio;
                newY = this.resizeStartData.y + (this.resizeStartData.height - newHeight) / 2;
                break;
            case 'left':
                newWidth = Math.max(50, this.resizeStartData.width - deltaX);
                newHeight = newWidth / aspectRatio;
                newX = this.resizeStartData.x + (this.resizeStartData.width - newWidth);
                newY = this.resizeStartData.y + (this.resizeStartData.height - newHeight) / 2;
                break;
            case 'bottom':
                newHeight = Math.max(50, this.resizeStartData.height + deltaY);
                newWidth = newHeight * aspectRatio;
                newX = this.resizeStartData.x + (this.resizeStartData.width - newWidth) / 2;
                break;
            case 'top':
                newHeight = Math.max(50, this.resizeStartData.height - deltaY);
                newWidth = newHeight * aspectRatio;
                newX = this.resizeStartData.x + (this.resizeStartData.width - newWidth) / 2;
                newY = this.resizeStartData.y + (this.resizeStartData.height - newHeight);
                break;
        }
        
        // Apply changes
        imageData.width = newWidth;
        imageData.height = newHeight;
        imageData.x = newX;
        imageData.y = newY;
        imageData.scale = newWidth / imageData.originalWidth;
        
        this.drawCanvas();
    }
    
    handleDrag(pos) {
        const deltaX = pos.x - this.dragStartX;
        const deltaY = pos.y - this.dragStartY;
        
        const imageData = this.currentImageSide === 'left' ? this.leftImageData : this.rightImageData;
        
        // No constraints on movement - allow unlimited overflow
        imageData.x += deltaX;
        imageData.y += deltaY;
        
        this.dragStartX = pos.x;
        this.dragStartY = pos.y;
        
        this.drawCanvas();
    }
    
    handleMouseUp() {
        this.isDragging = false;
        this.isResizing = false;
        this.currentImageSide = null;
        this.resizeHandle = null;
        this.resizeStartData = null;
    }
    
    handleScaleSlider(event, side) {
        const value = parseInt(event.target.value);
        const newScale = value / 100;
        const imageData = side === 'left' ? this.leftImageData : this.rightImageData;
        
        if (!imageData.originalWidth) return;
        
        // Store center point for scaling
        const centerX = imageData.x + imageData.width / 2;
        const centerY = imageData.y + imageData.height / 2;
        
        // Update scale and dimensions
        imageData.scale = newScale;
        imageData.width = imageData.originalWidth * newScale;
        imageData.height = imageData.originalHeight * newScale;
        
        // Maintain center position
        imageData.x = centerX - imageData.width / 2;
        imageData.y = centerY - imageData.height / 2;
        
        // Update display
        const valueSpan = side === 'left' ? '#leftScaleValue' : '#rightScaleValue';
        $(valueSpan).text(value + '%');
        
        this.drawCanvas();
    }
    
    handleDirectionalControl(event) {
        const side = $(event.target).data('side');
        const direction = $(event.target).data('dir');
        const imageData = side === 'left' ? this.leftImageData : this.rightImageData;
        const stepSize = 20; // pixels to move per click
        
        if (!imageData.originalWidth) return;
        
        switch (direction) {
            case 'up':
                imageData.y -= stepSize;
                break;
            case 'down':
                imageData.y += stepSize;
                break;
            case 'left':
                imageData.x -= stepSize;
                break;
            case 'right':
                imageData.x += stepSize;
                break;
            case 'center':
                // Center the image in its half
                const maxWidth = 1490;
                const maxHeight = 2000;
                if (side === 'left') {
                    imageData.x = (maxWidth - imageData.width) / 2;
                } else {
                    imageData.x = 1510 + (maxWidth - imageData.width) / 2;
                }
                imageData.y = (maxHeight - imageData.height) / 2;
                break;
        }
        
        this.drawCanvas();
    }
    
    handleWheel(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        let imageData = null;
        let image = null;
        let side = null;
        
        // Determine which side based on X coordinate
        if (pos.x < 1490 && this.leftImage) {
            imageData = this.leftImageData;
            image = this.leftImage;
            side = 'left';
        } else if (pos.x > 1510 && this.rightImage) {
            imageData = this.rightImageData;
            image = this.rightImage;
            side = 'right';
        }
        
        if (!imageData || !image) return;
        
        const scaleFactor = e.originalEvent.deltaY > 0 ? 0.9 : 1.1;
        const newScale = imageData.scale * scaleFactor;
        
        // Limit scaling
        if (newScale < 0.1 || newScale > 10) return;
        
        const oldWidth = imageData.width;
        const oldHeight = imageData.height;
        
        imageData.scale = newScale;
        imageData.width = imageData.originalWidth * newScale;
        imageData.height = imageData.originalHeight * newScale;
        
        // Adjust position to zoom towards mouse
        const mouseXRel = (pos.x - imageData.x) / oldWidth;
        const mouseYRel = (pos.y - imageData.y) / oldHeight;
        
        imageData.x = pos.x - mouseXRel * imageData.width;
        imageData.y = pos.y - mouseYRel * imageData.height;
        
        // No constraints - allow unlimited overflow
        
        // Update scale slider
        const scalePercent = Math.round(newScale * 100);
        if (side === 'left') {
            $('#leftScaleSlider').val(scalePercent);
            $('#leftScaleValue').text(scalePercent + '%');
        } else {
            $('#rightScaleSlider').val(scalePercent);
            $('#rightScaleValue').text(scalePercent + '%');
        }
        
        this.drawCanvas();
    }
    
    switchImages() {
        if (!this.leftImage || !this.rightImage) return;
        
        // Swap images
        [this.leftImage, this.rightImage] = [this.rightImage, this.leftImage];
        
        // Swap data and adjust positions
        const tempData = { ...this.leftImageData };
        this.leftImageData = { ...this.rightImageData };
        this.rightImageData = tempData;
        
        // Adjust X positions for new sides - no constraints, allow overflow
        this.leftImageData.x = this.leftImageData.x - 1510;
        this.rightImageData.x = this.rightImageData.x + 1510;
        
        // Swap copyright info
        [this.leftCopyright, this.rightCopyright] = [this.rightCopyright, this.leftCopyright];
        this.mergeCopyright();
        
        // Update UI
        const leftName = $('#leftImageName').text();
        const leftDim = $('#leftImageDimensions').text();
        const rightName = $('#rightImageName').text();
        const rightDim = $('#rightImageDimensions').text();
        
        $('#leftImageName').text(rightName);
        $('#leftImageDimensions').text(rightDim);
        $('#rightImageName').text(leftName);
        $('#rightImageDimensions').text(leftDim);
        
        // Swap scale slider values
        const leftScale = $('#leftScaleSlider').val();
        const rightScale = $('#rightScaleSlider').val();
        const leftScaleText = $('#leftScaleValue').text();
        const rightScaleText = $('#rightScaleValue').text();
        
        $('#leftScaleSlider').val(rightScale);
        $('#rightScaleSlider').val(leftScale);
        $('#leftScaleValue').text(rightScaleText);
        $('#rightScaleValue').text(leftScaleText);
        
        // Clear selection
        this.selectedImage = null;
        
        this.drawCanvas();
    }
    
    updateControls() {
        const hasImages = this.leftImage && this.rightImage;
        $('#switchBtn').prop('disabled', !hasImages);
        $('#exportBtn').prop('disabled', !hasImages);
    }
    
    drawCanvasForExport(ctx) {
        // Clear canvas
        ctx.clearRect(0, 0, 3000, 2000);
        
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 3000, 2000);
        
        // Draw center divider
        ctx.fillStyle = 'white';
        ctx.fillRect(1490, 0, 20, 2000);
        
        // Set up clipping for left side
        if (this.leftImage) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, 1490, 2000);
            ctx.clip();
            
            ctx.drawImage(
                this.leftImage,
                this.leftImageData.x,
                this.leftImageData.y,
                this.leftImageData.width,
                this.leftImageData.height
            );
            ctx.restore();
        }
        
        // Set up clipping for right side
        if (this.rightImage) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(1510, 0, 1490, 2000);
            ctx.clip();
            
            ctx.drawImage(
                this.rightImage,
                this.rightImageData.x,
                this.rightImageData.y,
                this.rightImageData.width,
                this.rightImageData.height
            );
            ctx.restore();
        }
        
        // Note: We do NOT draw selection borders or resize handles for export
    }
    
    exportImage() {
        if (!this.leftImage || !this.rightImage) return;
        
        // Get the copyright/author information from the field
        const authorInfo = $('#copyrightField').val() || '';
        
        // Create a temporary canvas for export
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 3000;
        exportCanvas.height = 2000;
        const exportCtx = exportCanvas.getContext('2d');
        
        // Draw only the images without any UI elements
        this.drawCanvasForExport(exportCtx);
        
        // Export as blob
        exportCanvas.toBlob((blob) => {
            if (authorInfo) {
                this.embedExifWithExifJs2(blob, authorInfo);
            } else {
                this.downloadBlob(blob, 'banfinator_kombinerad_bild.jpg');
            }
        }, 'image/jpeg', 0.8);
    }
    
    embedExifWithExifJs2(blob, authorInfo) {
        try {
            // Convert blob to array buffer for manual IPTC injection
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const dataView = new DataView(arrayBuffer);
                    
                    // Check if it's a valid JPEG (starts with 0xFFD8)
                    if (dataView.getUint16(0, false) !== 0xFFD8) {
                        throw new Error('Not a valid JPEG file');
                    }
                    
                    // Create IPTC data with Byline field
                    const iptcData = this.createIptcWithByline(authorInfo);
                    const newJpegBuffer = this.insertIptcIntoJpeg(arrayBuffer, iptcData);
                    
                    if (newJpegBuffer) {
                        const newBlob = new Blob([newJpegBuffer], { type: 'image/jpeg' });
                        this.downloadBlob(newBlob, 'banfinator_kombinerad_bild.jpg');
                        console.log('IPTC Byline metadata embedded successfully. Author:', authorInfo);
                    } else {
                        throw new Error('Failed to create IPTC data');
                    }
                    
                } catch (error) {
                    console.error('Failed to embed IPTC metadata:', error);
                    this.downloadBlob(blob, 'banfinator_kombinerad_bild.jpg');
                    console.log('Downloaded without IPTC metadata due to error');
                }
            };
            reader.readAsArrayBuffer(blob);
            
        } catch (error) {
            console.error('Failed to process blob:', error);
            this.downloadBlob(blob, 'banfinator_kombinerad_bild.jpg');
        }
    }
    
    createIptcWithByline(authorInfo) {
        // Create IPTC-IIM data structure
        // IPTC uses Tag-Length-Value format with record number and dataset number
        
        const authorBytes = new TextEncoder().encode(authorInfo);
        
        // IPTC Byline tag: Record 2, Dataset 80 (0x50)
        // Tag format: 0x1C (tag marker) + Record + Dataset + Length + Data
        const iptcEntry = new Uint8Array(5 + authorBytes.length);
        
        iptcEntry[0] = 0x1C; // IPTC tag marker
        iptcEntry[1] = 0x02; // Record 2 (Application Record)
        iptcEntry[2] = 0x50; // Dataset 80 (Byline/Author)
        iptcEntry[3] = (authorBytes.length >> 8) & 0xFF; // Length high byte
        iptcEntry[4] = authorBytes.length & 0xFF; // Length low byte
        iptcEntry.set(authorBytes, 5); // Author data
        
        // Also add Software/Program tag (Record 2, Dataset 65)
        const softwareText = "The Banfinator";
        const softwareBytes = new TextEncoder().encode(softwareText);
        const softwareEntry = new Uint8Array(5 + softwareBytes.length);
        
        softwareEntry[0] = 0x1C; // IPTC tag marker
        softwareEntry[1] = 0x02; // Record 2 (Application Record)
        softwareEntry[2] = 0x41; // Dataset 65 (Program/Software)
        softwareEntry[3] = (softwareBytes.length >> 8) & 0xFF; // Length high byte
        softwareEntry[4] = softwareBytes.length & 0xFF; // Length low byte
        softwareEntry.set(softwareBytes, 5); // Software data
        
        // Combine IPTC entries
        const totalLength = iptcEntry.length + softwareEntry.length;
        const iptcData = new Uint8Array(totalLength);
        iptcData.set(iptcEntry, 0);
        iptcData.set(softwareEntry, iptcEntry.length);
        
        return iptcData;
    }
    
    insertIptcIntoJpeg(jpegBuffer, iptcData) {
        try {
            const jpeg = new Uint8Array(jpegBuffer);
            
            // Find insertion point after SOI (0xFFD8)
            let insertPoint = 2;
            
            // Look for existing APP13 marker (0xFFED) which contains IPTC data
            if (jpeg.length > 4 && jpeg[2] === 0xFF && jpeg[3] === 0xED) {
                const app13Length = (jpeg[4] << 8) | jpeg[5];
                insertPoint = 4 + app13Length;
            }
            
            // Create Photoshop 3.0 8BIM resource for IPTC
            // Format: "Photoshop 3.0\0" + 8BIM + Resource ID + Name + Data
            const photoshopHeader = new TextEncoder().encode("Photoshop 3.0\0");
            const bimSignature = new Uint8Array([0x38, 0x42, 0x49, 0x4D]); // "8BIM"
            const resourceId = new Uint8Array([0x04, 0x04]); // 0x0404 = IPTC resource
            const resourceName = new Uint8Array([0x00, 0x00]); // Empty name (2 bytes for length + padding)
            
            // IPTC data length (4 bytes, big-endian)
            const dataLength = new Uint8Array(4);
            const dataView = new DataView(dataLength.buffer);
            dataView.setUint32(0, iptcData.length, false); // Big-endian
            
            // Calculate total APP13 length
            const app13ContentLength = photoshopHeader.length + bimSignature.length + 
                                     resourceId.length + resourceName.length + 
                                     dataLength.length + iptcData.length;
            const app13Length = app13ContentLength + 2; // +2 for length field itself
            
            // Create APP13 segment
            const app13Header = new Uint8Array([
                0xFF, 0xED, // APP13 marker
                (app13Length >> 8) & 0xFF, // Length high byte
                app13Length & 0xFF // Length low byte
            ]);
            
            // Combine all APP13 parts
            const app13Data = new Uint8Array(app13Header.length + app13ContentLength);
            let offset = 0;
            
            app13Data.set(app13Header, offset); offset += app13Header.length;
            app13Data.set(photoshopHeader, offset); offset += photoshopHeader.length;
            app13Data.set(bimSignature, offset); offset += bimSignature.length;
            app13Data.set(resourceId, offset); offset += resourceId.length;
            app13Data.set(resourceName, offset); offset += resourceName.length;
            app13Data.set(dataLength, offset); offset += dataLength.length;
            app13Data.set(iptcData, offset);
            
            // Create new JPEG with IPTC
            const newJpeg = new Uint8Array(jpeg.length + app13Data.length);
            
            // Copy SOI
            newJpeg.set(jpeg.slice(0, 2), 0);
            
            // Insert APP13 + IPTC
            newJpeg.set(app13Data, 2);
            
            // Copy rest of JPEG
            newJpeg.set(jpeg.slice(insertPoint), 2 + app13Data.length);
            
            return newJpeg;
            
        } catch (error) {
            console.error('Failed to insert IPTC into JPEG:', error);
            return null;
        }
    }
    
    embedExifAndDownload(dataUrl, authorInfo) {
        try {
            // Extract base64 data from data URL
            const base64Data = dataUrl.split(',')[1];
            
            // Check if this is valid JPEG data by looking at the data URL prefix
            if (!dataUrl.startsWith('data:image/jpeg')) {
                throw new Error('Canvas did not produce JPEG data');
            }
            
            // Try to load existing EXIF data or create new
            let exifDict;
            try {
                exifDict = piexif.load(dataUrl);
            } catch (e) {
                // No existing EXIF data, create new structure
                exifDict = {
                    "0th": {},
                    "Exif": {},
                    "GPS": {},
                    "1st": {},
                    "thumbnail": null
                };
            }
            
            // Set the EXIF data we want
            exifDict["0th"][piexif.ImageIFD.Artist] = authorInfo;
            exifDict["0th"][piexif.ImageIFD.Copyright] = authorInfo;
            exifDict["0th"][piexif.ImageIFD.Software] = "The Banfinator";
            
            // Convert EXIF object to binary
            const exifBinary = piexif.dump(exifDict);
            
            // Insert EXIF data into JPEG
            const newJpegBase64 = piexif.insert(exifBinary, base64Data);
            
            // Convert back to blob
            const byteCharacters = atob(newJpegBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const newBlob = new Blob([byteArray], { type: 'image/jpeg' });
            
            this.downloadBlob(newBlob, 'banfinator_kombinerad_bild.jpg');
            
            console.log('EXIF metadata embedded successfully. Author:', authorInfo);
            
        } catch (error) {
            console.error('Failed to embed EXIF metadata:', error);
            
            // Fallback: convert dataUrl to blob and download without metadata
            const byteCharacters = atob(dataUrl.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const fallbackBlob = new Blob([byteArray], { type: 'image/jpeg' });
            
            this.downloadBlob(fallbackBlob, 'banfinator_kombinerad_bild.jpg');
            console.log('Downloaded without EXIF metadata due to error');
        }
    }
    
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize the application
$(document).ready(() => {
    new ImageCombiner();
});