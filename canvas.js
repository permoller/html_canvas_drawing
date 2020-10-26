function initCanvas(canvasElement) {

    /**
     * @typedef {Object} IRect
     * @property {number} x
     * @property {number} y
     * @property {number} w
     * @property {number} h
     */

    /**
     * @typedef {Object} IPoint
     * @property {number} x
     * @property {number} y
     */

    /**
     * @typedef {Object} IMouseCanvasEvent
     * @property {"mousedown" | "mouseup" | "mousemove"} type
     * @property {boolean} handled
     * @property {Point} point
     * @property {number} which
     */

    /**
     * @typedef {Object} ICanvasKeyEvent
     * @property {"keydown"} type
     * @property {number} which
     */

    /**
     * @typedef {Object} ICanvasMouseCancelEvent
     * @property {"mousedowncancel"} type
     */

    /**
     * @typedef {IMouseCanvasEvent | ICanvasKeyEvent | ICanvasMouseCancelEvent} ICanvasEvent
     */

    /**
     * @callback HandleEvent
     * @param {ICanvasEvent} e
     * @returns {boolean} true if redraw is needed
     */

    /**
     * @callback MeasureRect
     * @returns {IRect} A rectangle surrounding the control
     */

    /**
     * @callback Draw
     * @returns {void}
     */

    /**
     * @param {IRect} rect
     * @param {IPoint} point
     */
    rectContainsPoint = (rect, point) => point.x >= rect.x && point.x <= (rect.x + rect.w) && point.y >= rect.y && point.y <= (rect.y + rect.h)


    /**
     * @param {IRect[]} rects
     * @returns {IRect} A rect surrounding all the rects.
     */
    rectMerge = (rects) => {
        const minX = Math.min(rects.map(r => r.x))
        const minY = Math.min(rects.map(r => r.y))
        const maxX = Math.max(rects.map(r => r.x))
        const maxY = Math.max(rects.map(r => r.y))
        return {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY
        }
    }



    class CanvasItem {
        /**
         * @param {CanvasRenderingContext2D} ctx
         */
        constructor(ctx) {
            this.ctx = ctx
        }

        /** @type Draw */
        draw = () => { }

        /** @type MeasureRect */
        measureRect = () => ({ x: 0, y: 0, h: 0, w: 0 })
    }

    class Rect extends CanvasItem {
        /**
         * @param {CanvasRenderingContext2D} ctx
         * @param {IRect} rect
         * @param {string} fill
         */
        constructor(ctx, rect) {
            super(ctx)
            this.x = rect.x
            this.y = rect.y
            this.w = rect.w
            this.h = rect.h
        }

        /** @type Draw */
        draw = () => {
            this.ctx.fillStyle = "#eeeeee"
            this.ctx.fillRect(this.x, this.y, this.w, this.h)
            this.ctx.strokeStyle = "#000000"
            this.ctx.strokeRect(this.x, this.y, this.w, this.h)
        }

        /** @type MeasureRect */
        measureRect = () => this
    }

    class Text extends CanvasItem {
        /**
         * @param {CanvasRenderingContext2D} ctx
         * @param {number} x
         * @param {CanvasTextAlign} xAlign
         * @param {number} y
         * @param {CanvasTextBaseline} yAlign
         * @param {string} text
         */
        constructor(ctx, x, xAlign, y, yAlign, text) {
            super(ctx)
            this.x = x
            this.xAlign = xAlign
            this.y = y
            this.yAlign = yAlign
            this.text = text
        }

        /** @type Draw */
        draw = () => {
            this.ctx.textBaseline = this.yAlign
            this.ctx.textAlign = this.xAlign
            this.ctx.fillStyle = "#000000"
            this.ctx.fillText(this.text, this.x, this.y)
        }

        /** @type {MeasureRect} */
        measureRect = () => {
            const size = this.ctx.measureText(this.text)
            return { x: this.x, y: this.y, w: size.width, h: parseInt(this.ctx.font) }
        }
    }

    class Control extends CanvasItem {
        /**
         * @param {CanvasRenderingContext2D} ctx
         */
        constructor(ctx) {
            super(ctx);
        }

        /** @type HandleEvent */
        handleEvent = e => false
    }

    class Box extends Control {
        /**
         * @param {CanvasRenderingContext2D} ctx
         * @param {IRect} rect
         */
        constructor(ctx, rect) {
            super(ctx);
            this.rect = new Rect(ctx, rect);
        }

        /** @type HandleEvent */
        handleEvent = e => {
            let redrawNeeded = false;
            if (e.type === "mousedown" && !e.handled && e.which === 1 && rectContainsPoint(this.rect, e.point)) {
                e.handled = true
                this.mousedown = { rectPoint: { x: this.rect.x, y: this.rect.y }, mousePoint: e.point }
                redrawNeeded = true
            } else if (e.type === "mousedowncancel" && e.which === 1 && this.mousedown) {
                this.rect.x = this.mousedown.rectPoint.x
                this.rect.y = this.mousedown.rectPoint.y
                redrawNeeded = true
            } else if (e.type === "mousemove" && this.mousedown) {
                this.rect.x = this.mousedown.rectPoint.x + (e.point.x - this.mousedown.mousePoint.x)
                this.rect.y = this.mousedown.rectPoint.y + (e.point.y - this.mousedown.mousePoint.y)
                redrawNeeded = true
            } else if (e.type === "mouseup" && e.which === 1 && this.mousedown) {
                this.rect.x = this.mousedown.rectPoint.x + (e.point.x - this.mousedown.mousePoint.x)
                this.rect.y = this.mousedown.rectPoint.y + (e.point.y - this.mousedown.mousePoint.y)
                this.mousedown = undefined
                redrawNeeded = true
            }
            return redrawNeeded
        }

        /** @type Draw */
        draw = () => {
            this.rect.draw()
        }

        /** @type MeasureRect */
        measureRect = () => this.rect
    }

    class ContextmenuItem extends Control {

        /**
         * @param {CanvasRenderingContext2D} ctx
         * @param {IRect} rect
         * @param {string} text
         * @param {() => void} onClick
         */
        constructor(ctx, rect, text, onClick) {
            super(ctx)
            this.text = new Text(ctx, rect.x + 10, "start", rect.y + rect.h / 2, "middle", text)
            this.rect = new Rect(ctx, rect)
            this.onClick = onClick
        }

        /** @type HandleEvent */
        handleEvent = e => {
            if (e.type === "mouseup" && e.which === 1 && rectContainsPoint(this.rect, e.point)) {
                this.onClick()
                return true
            }
            return false
        }

        /** @type Draw */
        draw = () => {
            this.rect.draw()
            this.text.draw()
        }

        /** @type MeasureRect */
        measureRect = () => this.rect
    }

    class Contextmenu extends Control {
        /**
         * @param {CanvasRenderingContext2D} ctx
         * @param {number} x
         * @param {number} y
         * @param {() => void} onDismiss - Called when the context menu should be removed
         * @param {Object[]} items
         * @param {string} items.text
         * @param {() => void} items.onClick
         */
        constructor(ctx, x, y, onDismiss, items) {
            super(ctx)
            this.onDismiss = onDismiss
            const itemWidth = 150;
            const itemHeight = 20;
            // adjust context menu to stay within the canvas
            if (x + itemWidth > ctx.canvas.width) {
                x = ctx.canvas.width - itemWidth;
            }
            if (y + items.length * itemHeight > ctx.canvas.height) {
                y = ctx.canvas.height - items.length * itemHeight;
            }
            this.items = items.map((item, index) => new ContextmenuItem(ctx, { x: x, y: y + index * itemHeight, w: itemWidth, h: itemHeight }, item.text, item.onClick))

        }

        /** @type HandleEvent */
        handleEvent = e => {
            let redrawNeeded = false;
            this.items.reverse().forEach(item => redrawNeeded |= item.handleEvent(e))
            if (e.type === "mouseup" || e.type === "mousedowncancel") {
                this.onDismiss()
                redrawNeeded = true
            }
            return redrawNeeded
        }

        /** @type Draw */
        draw = () => {
            this.items.forEach(i => i.draw())
        }
        /** @type MeasureRect */
        measureRect = () => rectMerge(this.items.map(item => item.measureRect()))
    }

    class Canvas2d {
        /**
         * @param {HTMLCanvasElement} canvasElement 
         */
        constructor(canvasElement) {
            this.canvasElement = canvasElement
            this.ctx = canvasElement.getContext("2d")

            // Object with flags indicating which mousebuttons are pressed.
            this.mousedown = {}

            /** @type {Control[]} */
            this.controls = []

            const handleEvent = e => {
                if (this.handleEvent(e)) {
                    console.log("redraw")
                    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
                    this.controls.forEach(c => c.draw())
                }
            }
            document.addEventListener("mousedown", handleEvent)
            document.addEventListener("mousemove", handleEvent)
            document.addEventListener("mouseup", handleEvent)
            document.addEventListener("keydown", handleEvent)
            document.addEventListener("contextmenu", handleEvent)
        }

        addControl = control => this.controls = [...this.controls, control]
        removeControl = control => this.controls = this.controls.filter(c => c !== control)

        /**
         * @param {MouseEvent | KeyboardEvent} e
         */
        handleEvent = e => {
            let redrawNeeded = false;

            if (e.target === this.canvasElement) {
                let ignoreEvent = false

                // if the user press a mouse-button outside the canvas but releases it inside the canvas we ignore the mouseup-event (but not the contextmenu-event)
                if (e.type === "mouseup" && !this.mousedown[e.which]) {
                    ignoreEvent = true
                }

                // keep track of the mouse-buttons that are pressed and released inside the canvas
                if (e.type === "mousedown") {
                    this.mousedown[e.which] = true
                } else if (e.type === "mouseup") {
                    this.mousedown[e.which] = false
                }

                if (!ignoreEvent) {

                    redrawNeeded |= this.dispatchEventToControls({ type: e.type, point: { x: e.offsetX, y: e.offsetY }, which: e.which, handled: false })
                    if (e.type === "contextmenu") {
                        e.preventDefault()

                        const contextMenu = new Contextmenu(this.ctx, e.offsetX, e.offsetY, () => this.removeControl(contextMenu), [
                            {
                                text: "box",
                                onClick: () => this.addControl(new Box(this.ctx, { x: e.offsetX, y: e.offsetY, w: 150, h: 150 }))
                            },
                            { text: "test 2", onClick: () => alert("test 2") },
                            { text: "test 3", onClick: () => alert("test 3") }
                        ]

                        )
                        this.addControl(contextMenu)
                        redrawNeeded |= true
                    }

                }
            } else {
                // if the user press a mouse-button inside the canvas but releases it outside the canvas we tell the components to cancel what they are doing due to the mousedown event
                if (e.type === "mouseup" && this.mousedown[e.which]) {
                    this.mousedown[e.which] = false
                    redrawNeeded |= this.dispatchEventToControls({ type: "mousedowncancel", which: e.which })
                }
            }

            return redrawNeeded
        }

        dispatchEventToControls = (event) => this.controls.reduceRight((needsRedraw, control) => control.handleEvent(event) || needsRedraw, false)

    }


    new Canvas2d(canvasElement)
}
