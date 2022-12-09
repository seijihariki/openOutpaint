/**
 * This is a manager for the many canvas and content layers that compose the application
 *
 * It manages canvases and their locations and sizes according to current viewport views
 */
const layers = {
	_collections: [],
	collections: makeWriteOnce({}, "layers.collections"),

	listen: {
		oncollectioncreate: new Observer(),
		oncollectiondelete: new Observer(),

		onlayercreate: new Observer(),
		onlayerdelete: new Observer(),
	},

	// Registers a new collection
	// Layer collections are a group of layers (canvases) that are rendered in tandem. (same width, height, position, transform, etc)
	registerCollection: (key, size, options = {}) => {
		defaultOpt(options, {
			// Display name for the collection
			name: key,

			// Initial layer
			initLayer: {
				key: "default",
				options: {},
			},

			// Input multiplier (Size of the input element div)
			inputSizeMultiplier: 999, // It is invisible, so not much of a performance difference

			// Target
			targetElement: document.getElementById("layer-render"),

			// Resolution of the image
			resolution: size,
		});

		if (options.inputSizeMultiplier % 2 === 0) options.inputSizeMultiplier++;

		// Path used for logging purposes
		const _logpath = "layers.collections." + key;

		// Collection ID
		const id = guid();

		// Collection element
		const element = document.createElement("div");
		element.id = `collection-${id}`;
		element.style.width = `${size.w}px`;
		element.style.height = `${size.h}px`;
		element.classList.add("collection");

		// Input element (overlay element for input handling)
		const inputel = document.createElement("div");
		inputel.id = `collection-input-${id}`;
		inputel.addEventListener("mouseover", (evn) => {
			document.activeElement.blur();
		});
		inputel.classList.add("collection-input-overlay");
		element.appendChild(inputel);

		options.targetElement.appendChild(element);

		const collection = makeWriteOnce(
			{
				id,

				_logpath,

				_layers: [],
				layers: {},

				name: options.name,
				element,
				inputElement: inputel,

				_inputOffset: null,
				get inputOffset() {
					return this._inputOffset;
				},

				_origin: {x: 0, y: 0},
				get origin() {
					return Object.assign({}, this._origin);
				},

				_resizeInputDiv() {
					// Set offset
					this._inputOffset = {
						x: -Math.floor(options.inputSizeMultiplier / 2) * this.size.w,
						y: -Math.floor(options.inputSizeMultiplier / 2) * this.size.h,
					};

					// Resize the input element
					this.inputElement.style.left = `${this.inputOffset.x}px`;
					this.inputElement.style.top = `${this.inputOffset.y}px`;
					this.inputElement.style.width = `${
						this.size.w * options.inputSizeMultiplier
					}px`;
					this.inputElement.style.height = `${
						this.size.h * options.inputSizeMultiplier
					}px`;
				},

				/**
				 * Expands collection and full layers contained
				 *
				 * @param {number} left Pixels to expand left
				 * @param {number} right Pixels to expand right
				 * @param {number} top Pixels to expand top
				 * @param {number} bottom Pixels to expand bottom
				 */
				expand(left, right, top, bottom) {
					// Create layer backup canvas
					const bkp = document.createElement("canvas");
					bkp.width = this.size.w;
					bkp.height = this.size.h;
					const bkpctx = bkp.getContext("2d");

					// Expand base collection size
					this.size.w += left + right;
					this.size.h += top + bottom;
					this._origin.x += left;
					this._origin.y += top;
					this.element.style.width = this.size.w + "px";
					this.element.style.height = this.size.h + "px";

					// Expand full layers, one by one
					this._layers.forEach((layer) => {
						// Only resize full layers
						if (!layer.full) return;

						// Backup the layer contents
						bkpctx.clearRect(0, 0, bkp.width, bkp.height);
						bkpctx.drawImage(layer.canvas, 0, 0);

						// Resize the layer in place
						const {cw, ch} = layer.resize(this.size.w, this.size.h);
						layer.ctx.clearRect(0, 0, cw, ch);

						// Apply translation here, for global origin transform
						layer.ctx.translate(left, top);
						layer.ctx.drawImage(bkp, 0, 0);
					});

					this._resizeInputDiv();
				},

				size,
				resolution: options.resolution,

				/**
				 * Registers a new layer
				 *
				 * @param {string | null} key Name and key to use to access layer. If null, it is a temporary layer.
				 * @param {object} options
				 * @param {string} options.name
				 * @param {?BoundingBox} options.bb
				 * @param {{w: number, h: number}} options.resolution
				 * @param {?string} options.group
				 * @param {object} options.after
				 * @param {object} options.ctxOptions
				 * @returns
				 */
				registerLayer: (key = null, options = {}) => {
					// Make ID
					const id = guid();

					defaultOpt(options, {
						// Display name for the layer
						name: key || `Temporary ${id}`,

						// Bounding box for layer
						bb: {x: 0, y: 0, w: collection.size.w, h: collection.size.h},

						// Resolution for layer
						resolution: null,

						// Group for the layer ("group/subgroup/subsubgroup")
						group: null,

						// If set, will insert the layer after the given one
						after: null,

						// Context creation options
						ctxOptions: {},

						// Full Layer (If the layer is supposed to be the full size of the collection)
						full: true,
					});

					// Cannot be full if bb is not default
					if (
						options.bb.x !== 0 ||
						options.bb.y !== 0 ||
						options.bb.w !== collection.size.w ||
						options.bb.h !== collection.size.h
					)
						options.full = false;

					// Calculate resolution
					if (!options.resolution)
						options.resolution = {
							w: (collection.resolution.w / collection.size.w) * options.bb.w,
							h: (collection.resolution.h / collection.size.h) * options.bb.h,
						};

					// This layer's canvas
					// This is where black magic will take place in the future
					/**
					 * @todo Use the canvas black arts to auto-scale canvas
					 */
					const canvas = document.createElement("canvas");
					canvas.id = `layer-${id}`;

					canvas.style.left = `${options.bb.x}px`;
					canvas.style.top = `${options.bb.y}px`;
					canvas.style.width = `${options.bb.w}px`;
					canvas.style.height = `${options.bb.h}px`;
					canvas.width = options.resolution.w;
					canvas.height = options.resolution.h;

					if (!options.after) collection.element.appendChild(canvas);
					else {
						options.after.canvas.after(canvas);
					}

					const ctx = canvas.getContext("2d", options.ctxOptions);
					const rootctx = canvas.getContext("2d", options.ctxOptions);

					// Path used for logging purposes
					const _layerlogpath = key
						? _logpath + ".layers." + key
						: _logpath + ".layers[" + id + "]";
					const layer = makeWriteOnce(
						{
							_logpath: _layerlogpath,
							_collection: collection,

							id,
							key,
							name: options.name,

							_full: options.full,
							get full() {
								return this._full;
							},

							state: new Proxy(
								{visible: true},
								{
									set(obj, opt, val) {
										switch (opt) {
											case "visible":
												layer.canvas.style.display = val ? "block" : "none";
												break;
										}
										obj[opt] = val;
									},
								}
							),

							/** Our canvas */
							canvas,
							ctx,
							rootctx,

							/**
							 * Moves this layer to another level (after given layer)
							 *
							 * @param {Layer} layer Will move layer to after this one
							 */
							moveAfter(layer) {
								layer.canvas.after(this.canvas);
							},

							/**
							 * Moves this layer to another level (before given layer)
							 *
							 * @param {Layer} layer Will move layer to before this one
							 */
							moveBefore(layer) {
								layer.canvas.before(this.canvas);
							},

							/**
							 * Moves this layer to another location
							 *
							 * @param {number} x X coordinate of the top left of the canvas
							 * @param {number} y Y coordinate of the top left of the canvas
							 */
							moveTo(x, y) {
								canvas.style.left = `${x}px`;
								canvas.style.top = `${y}px`;
							},

							/**
							 * Resizes layer in place
							 *
							 * @param {number} w New width
							 * @param {number} h New height
							 */
							resize(w, h) {
								canvas.width = Math.round(
									options.resolution.w * (w / options.bb.w)
								);
								canvas.height = Math.round(
									options.resolution.h * (h / options.bb.h)
								);
								canvas.style.width = `${w}px`;
								canvas.style.height = `${h}px`;

								return {cw: canvas.width, ch: canvas.height, w, h};
							},

							// Hides this layer (don't draw)
							hide() {
								this.canvas.style.display = "none";
							},
							// Hides this layer (don't draw)
							unhide() {
								this.canvas.style.display = "block";
							},
						},
						_layerlogpath
					);

					// Add to indexers
					if (!options.after) collection._layers.push(layer);
					else {
						const index = collection._layers.findIndex(
							(l) => l === options.after
						);
						collection._layers.splice(index, 0, layer);
					}
					if (key) collection.layers[key] = layer;

					if (key === null)
						console.debug(
							`[layers] Anonymous layer '${layer.name}' registered`
						);
					else
						console.info(
							`[layers] Layer '${layer.name}' at ${layer._logpath} registered`
						);

					layers.listen.onlayercreate.emit({
						layer,
					});
					return layer;
				},

				// Deletes a layer
				deleteLayer: (layer) => {
					const lobj = collection._layers.splice(
						collection._layers.findIndex(
							(l) => l.id === layer || l.id === layer.id
						),
						1
					)[0];
					if (!lobj) return;

					layers.listen.onlayerdelete.emit({
						layer: lobj,
					});
					if (lobj.key) delete collection.layers[lobj.key];

					collection.element.removeChild(lobj.canvas);

					if (lobj.key) console.info(`[layers] Layer '${lobj.key}' deleted`);
					else console.debug(`[layers] Anonymous layer '${lobj.id}' deleted`);
				},
			},
			_logpath,
			["_inputOffset"]
		);

		collection._resizeInputDiv();

		layers._collections.push(collection);
		layers.collections[key] = collection;

		console.info(
			`[layers] Collection '${options.name}' at ${_logpath} registered`
		);

		return collection;
	},
};
