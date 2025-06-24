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
            const copyright = EXIF.getTag(file, 'Copyright') || 
                            EXIF.getTag(file, 'Artist') || 
                            EXIF.getTag(file, 'Author') || '';
            
            if (side === 'left') {
                this.leftCopyright = copyright;
            } else {
                this.rightCopyright = copyright;
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
    
    exportImage() {
        if (!this.leftImage || !this.rightImage) return;
        
        // Create a temporary canvas for export
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 3000;
        exportCanvas.height = 2000;
        const exportCtx = exportCanvas.getContext('2d');
        
        // Draw the current canvas content
        this.drawCanvas();
        exportCtx.drawImage(this.canvas, 0, 0);
        
        // Export as JPG with 80% quality
        exportCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'banfinator_kombinerad_bild.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/jpeg', 1.0);
    }
}

// Initialize the application
$(document).ready(() => {
    new ImageCombiner();
});