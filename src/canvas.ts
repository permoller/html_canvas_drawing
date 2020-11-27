
function initCanvas(canvasElement: HTMLCanvasElement) {

    interface IRect {
        x: number
        y: number
        w: number
        h: number
    }

    interface IPoint {
        x: number
        y: number
    }

    interface IMouseCanvasEvent {
        type: "mousedown" | "mouseup" | "mousemove"
        handled: boolean
        point: IPoint
        which: number
    }

    interface ICanvasKeyEvent {
        type: "keydown"
        which: number
    }

    interface ICanvasMouseCancelEvent {
        type: "mousedowncancel"
        which: number
    }

    type ICanvasEvent = IMouseCanvasEvent | ICanvasKeyEvent | ICanvasMouseCancelEvent

    type HandleEvent = (e: ICanvasEvent) => Control

    /** @return a rectangle surrounding the control */
    type MeasureRect = () => IRect

    type Draw = () => void

    const rectContainsPoint = (rect: IRect, point: IPoint) => point.x >= rect.x && point.x <= (rect.x + rect.w) && point.y >= rect.y && point.y <= (rect.y + rect.h)


    /**
     * @returns A rect surrounding all the rects.
     */
    const rectMerge = (rects: IRect[]): IRect => {
        const minX = Math.min(...rects.map(r => r.x))
        const minY = Math.min(...rects.map(r => r.y))
        const maxX = Math.max(...rects.map(r => r.x))
        const maxY = Math.max(...rects.map(r => r.y))
        return {
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY
        }
    }


    class Control {

        constructor(protected ctx: CanvasRenderingContext2D) {

        }

        handleEvent: HandleEvent = _ => this

        draw: Draw = () => { }

        measureRect: MeasureRect = () => ({ x: 0, y: 0, h: 0, w: 0 })
    }

    class Rect extends Control {
        x: number
        y: number
        w: number
        h: number

        constructor(ctx: CanvasRenderingContext2D, rect: IRect) {
            super(ctx)
            this.x = rect.x
            this.y = rect.y
            this.w = rect.w
            this.h = rect.h
        }

        draw: Draw = () => {
            this.ctx.fillStyle = "#eeeeee"
            this.ctx.fillRect(this.x, this.y, this.w, this.h)
            this.ctx.strokeStyle = "#000000"
            this.ctx.strokeRect(this.x, this.y, this.w, this.h)
        }

        measureRect: MeasureRect = () => this
    }

    class Text extends Control {

        constructor(ctx: CanvasRenderingContext2D, private x: number, private xAlign: CanvasTextAlign, private y: number, private yAlign: CanvasTextBaseline, private text: string) {
            super(ctx)
        }

        draw: Draw = () => {
            this.ctx.textBaseline = this.yAlign
            this.ctx.textAlign = this.xAlign
            this.ctx.fillStyle = "#000000"
            this.ctx.fillText(this.text, this.x, this.y)
        }

        measureRect: MeasureRect = () => {
            const size = this.ctx.measureText(this.text)
            return { x: this.x, y: this.y, w: size.width, h: parseInt(this.ctx.font) }
        }
    }



    class Box extends Control {
        private rect: Rect;
        constructor(ctx: CanvasRenderingContext2D, rect: IRect, private mousedown?: { rectPoint: IPoint; mousePoint: IPoint; }) {
            super(ctx);
            this.rect = new Rect(ctx, rect);
        }

        handleEvent: HandleEvent = e => {
            if (e.type === "mousedown" && !e.handled && e.which === 1 && rectContainsPoint(this.rect, e.point)) {
                e.handled = true
                return new Box(this.ctx, this.rect, {
                    rectPoint: { x: this.rect.x, y: this.rect.y },
                    mousePoint: e.point
                })
            } else if (e.type === "mousedowncancel" && e.which === 1 && this.mousedown) {
                return new Box(this.ctx, {
                    x: this.mousedown.rectPoint.x,
                    y: this.mousedown.rectPoint.y,
                    w: this.rect.w,
                    h: this.rect.h
                }, this.mousedown)
            } else if (e.type === "mousemove" && this.mousedown) {
                return new Box(this.ctx, {
                    x: this.mousedown.rectPoint.x + (e.point.x - this.mousedown.mousePoint.x),
                    y: this.mousedown.rectPoint.y + (e.point.y - this.mousedown.mousePoint.y),
                    w: this.rect.w,
                    h: this.rect.h
                }, this.mousedown)
            } else if (e.type === "mouseup" && e.which === 1 && this.mousedown) {
                return new Box(this.ctx, {
                    x: this.mousedown.rectPoint.x + (e.point.x - this.mousedown.mousePoint.x),
                    y: this.mousedown.rectPoint.y + (e.point.y - this.mousedown.mousePoint.y),
                    w: this.rect.w,
                    h: this.rect.h
                }, undefined)
            }
            return this
        }

        draw: Draw = () => {
            this.rect.draw()
        }

        measureRect: MeasureRect = () => this.rect
    }

    class ContextmenuItem extends Control {
        private text: Text
        private rect: Rect
        constructor(ctx: CanvasRenderingContext2D, rect: IRect, text: string, private onClick: () => void) {
            super(ctx)
            this.text = new Text(ctx, rect.x + 10, "start", rect.y + rect.h / 2, "middle", text)
            this.rect = new Rect(ctx, rect)
        }

        handleEvent: HandleEvent = e => {
            if (e.type === "mouseup" && e.which === 1 && rectContainsPoint(this.rect, e.point)) {
                this.onClick()
            }
            return this
        }

        draw: Draw = () => {
            this.rect.draw()
            this.text.draw()
        }

        measureRect: MeasureRect = () => this.rect
    }

    class Contextmenu extends Control {
        private items: ContextmenuItem[]
        constructor(ctx: CanvasRenderingContext2D, private x: number, private y: number, private onDismiss: () => void, items: { text: string, onClick: () => void }[]) {
            super(ctx)
            const itemWidth = 150;
            const itemHeight = 20;
            // adjust context menu to stay within the canvas
            if (x + itemWidth > ctx.canvas.width) {
                this.x = ctx.canvas.width - itemWidth;
            }
            if (y + items.length * itemHeight > ctx.canvas.height) {
                this.y = ctx.canvas.height - items.length * itemHeight;
            }
            this.items = items.map((item, index) => new ContextmenuItem(ctx, { x: x, y: y + index * itemHeight, w: itemWidth, h: itemHeight }, item.text, item.onClick))

        }

        handleEvent: HandleEvent = e => {
            // TODO: Fix newItems
            //const newItems: ContextmenuItem[] = []
            const itemsChanged = this.items.reduceRight((changed, item, index) => ((/*newItems[index] =*/ item.handleEvent(e)) != item) || changed, false)
            if (e.type === "mouseup" || e.type === "mousedowncancel") {
                this.onDismiss()
            }
            if (itemsChanged) {

                throw new Error("TODO: itemsChanged in ContextMenu")
                //return new Contextmenu(this.ctx, this.x, this.y, this.onDismiss, newItems)
            }
            return this
        }

        draw: Draw = () => {
            this.items.forEach(i => i.draw())
        }

        measureRect: MeasureRect = () => rectMerge(this.items.map(item => item.measureRect()))
    }

    class Canvas2d {
        private ctx: CanvasRenderingContext2D
        private controls: Control[];
        private controlsToAdd: Control[];
        private controlsToRemove: Control[];
        private mousedown: boolean[];

        constructor(private canvasElement: HTMLCanvasElement) {
            // TODO: Fix use of !
            this.ctx = canvasElement.getContext("2d")!

            // Object with flags indicating which mousebuttons are pressed.
            this.mousedown = []

            this.controls = []
            this.controlsToAdd = []
            this.controlsToRemove = []

            const handleEvent = (e: MouseEvent | KeyboardEvent) => {
                const oldControls = this.controls;
                const newControls = this.handleEvent(e)
                if (oldControls != newControls) {
                    this.controls = newControls
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


        handleEvent = (e: MouseEvent | KeyboardEvent): Control[] => {


            if (e.target === this.canvasElement) {
                let ignoreEvent = false
                // TODO: Handle keybardEvent
                if (e instanceof MouseEvent) {
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


                    if (e.type === "contextmenu") {
                        e.preventDefault()

                        const contextMenu = new Contextmenu(
                            this.ctx,
                            e.offsetX,
                            e.offsetY,
                            () => {
                                this.controlsToRemove.push(contextMenu)
                            },
                            [
                                {
                                    text: "box",
                                    onClick: () => {
                                        this.controlsToAdd.push(new Box(this.ctx, { x: e.offsetX, y: e.offsetY, w: 150, h: 150 }))
                                    }
                                },
                                { text: "test 2", onClick: () => alert("test 2") },
                                { text: "test 3", onClick: () => alert("test 3") }
                            ]

                        )
                        return [...this.controls, contextMenu]
                    }

                    if (!ignoreEvent) {
                        this.controlsToAdd = []
                        this.controlsToRemove = []
                        // TODO: Fix cast to any
                        let controls = this.dispatchEventToControls({ type: e.type as any, point: { x: e.offsetX, y: e.offsetY }, which: e.which, handled: false })
                        if (this.controlsToAdd.length > 0) {
                            controls = [...controls, ...this.controlsToAdd]
                        }
                        if (this.controlsToRemove.length > 0) {
                            controls = controls.filter(c => this.controlsToRemove.indexOf(c) < 0)
                        }
                        return controls
                    }
                }
            } else {
                // if the user press a mouse-button inside the canvas but releases it outside the canvas we tell the components to cancel what they are doing due to the mousedown event
                if (e.type === "mouseup" && this.mousedown[e.which]) {
                    this.mousedown[e.which] = false
                    return this.dispatchEventToControls({ type: "mousedowncancel", which: e.which })
                }
            }

            return this.controls
        }

        dispatchEventToControls = (event: ICanvasEvent) => {
            const newControls: Control[] = [];
            const controlsChanged = this.controls.reduceRight((changed, control, index) => ((newControls[index] = control.handleEvent(event)) != control) || changed, false)
            return controlsChanged ? newControls : this.controls
        }

    }


    new Canvas2d(canvasElement)
}
