/**
 * The layering UI window
 */

const uil = {
	_ui_layer_list: document.getElementById("layer-list"),
	layers: [],
	_active: null,
	set active(v) {
		Array.from(this._ui_layer_list.children).forEach((child) => {
			child.classList.remove("active");
		});

		v.entry.classList.add("active");

		this._active = v;
	},
	get active() {
		return this._active;
	},

	get layer() {
		return this.active && this.active.layer;
	},

	get canvas() {
		return this.layer && this.active.layer.canvas;
	},

	get ctx() {
		return this.layer && this.active.layer.ctx;
	},

	get rootctx() {
		return this.layer && this.active.layer.rootctx;
	},

	get w() {
		return imageCollection.size.w;
	},
	get h() {
		return imageCollection.size.h;
	},

	/**
	 * Synchronizes layer array to DOM
	 */
	_syncLayers() {
		const layersEl = document.getElementById("layer-list");

		const copy = this.layers.map((i) => i);
		copy.reverse();

		copy.forEach((uiLayer, index) => {
			// If we have the correct layer here, then do nothing
			if (
				layersEl.children[index] &&
				layersEl.children[index].id === `ui-layer-${uiLayer.id}`
			)
				return;

			// If the layer we are processing does not exist, then create it and add before current element
			if (!uiLayer.entry) {
				uiLayer.entry = document.createElement("div");
				uiLayer.entry.id = `ui-layer-${uiLayer.id}`;
				uiLayer.entry.classList.add("ui-layer");
				uiLayer.entry.addEventListener("click", () => {
					this.active = uiLayer;
				});

				// Title Element
				const titleEl = document.createElement("input");
				titleEl.classList.add("title");
				titleEl.value = uiLayer.name;
				titleEl.style.pointerEvents = "none";

				const deselect = () => {
					titleEl.style.pointerEvents = "none";
					titleEl.setSelectionRange(0, 0);
				};

				titleEl.addEventListener("blur", deselect);
				uiLayer.entry.appendChild(titleEl);

				uiLayer.entry.addEventListener("change", () => {
					const name = titleEl.value.trim();
					titleEl.value = name;
					uiLayer.entry.title = name;

					uiLayer.name = name;

					this._syncLayers();

					titleEl.blur();
				});
				uiLayer.entry.addEventListener("dblclick", () => {
					titleEl.style.pointerEvents = "auto";
					titleEl.focus();
					titleEl.select();
				});

				// Add action buttons
				const actionArray = document.createElement("div");
				actionArray.classList.add("actions");

				if (uiLayer.deletable) {
					const deleteButton = document.createElement("button");
					deleteButton.addEventListener(
						"click",
						(evn) => {
							evn.stopPropagation();
							commands.runCommand("deleteLayer", "Deleted Layer", {
								layer: uiLayer,
							});
						},
						{passive: false}
					);

					deleteButton.addEventListener(
						"dblclick",
						(evn) => {
							evn.stopPropagation();
						},
						{passive: false}
					);
					deleteButton.title = "Delete Layer";
					deleteButton.appendChild(document.createElement("div"));
					deleteButton.classList.add("delete-btn");

					actionArray.appendChild(deleteButton);
				}

				const hideButton = document.createElement("button");
				hideButton.addEventListener(
					"click",
					(evn) => {
						evn.stopPropagation();
						uiLayer.hidden = !uiLayer.hidden;
					},
					{passive: false}
				);
				hideButton.addEventListener(
					"dblclick",
					(evn) => {
						evn.stopPropagation();
					},
					{passive: false}
				);
				hideButton.title = "Hide/Unhide Layer";
				hideButton.appendChild(document.createElement("div"));
				hideButton.classList.add("hide-btn");

				actionArray.appendChild(hideButton);
				uiLayer.entry.appendChild(actionArray);

				if (layersEl.children[index])
					layersEl.children[index].before(uiLayer.entry);
				else layersEl.appendChild(uiLayer.entry);
			} else if (!layersEl.querySelector(`#ui-layer-${uiLayer.id}`)) {
				// If layer exists but is not on the DOM, add it back
				if (index === 0) layersEl.children[0].before(uiLayer.entry);
				else layersEl.children[index - 1].after(uiLayer.entry);
			} else {
				// If the layer already exists, just move it here
				layersEl.children[index].before(uiLayer.entry);
			}
		});

		// Deletes layer if not in array
		for (var i = 0; i < layersEl.children.length; i++) {
			if (!copy.find((l) => layersEl.children[i].id === `ui-layer-${l.id}`)) {
				layersEl.children[i].remove();
			}
		}

		// Synchronizes with the layer lib
		this.layers.forEach((uiLayer, index) => {
			if (index === 0) uiLayer.layer.moveAfter(bgLayer);
			else uiLayer.layer.moveAfter(copy[index - 1].layer);
		});
	},

	/**
	 * Adds a user-manageable layer for image editing.
	 *
	 * Should not be called directly. Use the command instead.
	 *
	 * @param {string} group The group the layer belongs to. [does nothing for now]
	 * @param {string} name The name of the new layer.
	 * @returns
	 */
	_addLayer(group, name) {
		const layer = imageCollection.registerLayer(null, {
			name,
			after:
				(this.layers.length > 0 && this.layers[this.layers.length - 1].layer) ||
				bgLayer,
		});

		const uiLayer = {
			id: layer.id,
			group,
			name,
			_hidden: false,
			set hidden(v) {
				if (v) {
					this._hidden = true;
					this.layer.hide(v);
					this.entry && this.entry.classList.add("hidden");
				} else {
					this._hidden = false;
					this.layer.unhide(v);
					this.entry && this.entry.classList.remove("hidden");
				}
			},
			get hidden() {
				return this._hidden;
			},
			entry: null,
			layer,
		};
		this.layers.push(uiLayer);

		this._syncLayers();

		this.active = uiLayer;

		return uiLayer;
	},

	/**
	 * Moves a layer to a specified position.
	 *
	 * Should not be called directly. Use the command instead.
	 *
	 * @param {UserLayer} layer Layer to move
	 * @param {number} position Position to move the layer to
	 */
	_moveLayerTo(layer, position) {
		if (position < 0 || position >= this.layers.length)
			throw new RangeError("Position out of bounds");

		const index = this.layers.indexOf(layer);
		if (index !== -1) {
			if (this.layers.length < 2) return; // Do nothing if moving a layer doesn't make sense

			this.layers.splice(index, 1);
			this.layers.splice(position, 0, layer);

			this._syncLayers();

			return;
		}
		throw new ReferenceError("Layer could not be found");
	},
	/**
	 * Moves a layer up a single position.
	 *
	 * Should not be called directly. Use the command instead.
	 *
	 * @param {UserLayer} [layer=uil.active] Layer to move
	 */
	_moveLayerUp(layer = uil.active) {
		const index = this.layers.indexOf(layer);
		if (index === -1) throw new ReferenceError("Layer could not be found");
		try {
			this._moveLayerTo(layer, index + 1);
		} catch (e) {}
	},
	/**
	 * Moves a layer down a single position.
	 *
	 * Should not be called directly. Use the command instead.
	 *
	 * @param {UserLayer} [layer=uil.active] Layer to move
	 */
	_moveLayerDown(layer = uil.active) {
		const index = this.layers.indexOf(layer);
		if (index === -1) throw new ReferenceError("Layer could not be found");
		try {
			this._moveLayerTo(layer, index - 1);
		} catch (e) {}
	},
	/**
	 * Function that returns a canvas with full visible information of a certain bounding box.
	 *
	 * For now, only the img is used.
	 *
	 * @param {BoundingBox} bb The bouding box to get visible data from
	 * @param {object} [options] Options
	 * @param {boolean} [options.includeBg=false] Whether to include the background
	 * @returns {HTMLCanvasElement}	The canvas element containing visible image data
	 */
	getVisible(bb, options = {}) {
		defaultOpt(options, {
			includeBg: false,
		});

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		canvas.width = bb.w;
		canvas.height = bb.h;
		if (options.includeBg)
			ctx.drawImage(bgLayer.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
		this.layers.forEach((layer) => {
			if (!layer.hidden)
				ctx.drawImage(
					layer.layer.canvas,
					bb.x,
					bb.y,
					bb.w,
					bb.h,
					0,
					0,
					bb.w,
					bb.h
				);
		});

		return canvas;
	},
};

/**
 * Command for creating a new layer
 */
commands.createCommand(
	"addLayer",
	(title, opt, state) => {
		const options = Object.assign({}, opt) || {};
		defaultOpt(options, {
			group: null,
			name: "New Layer",
			deletable: true,
		});

		if (!state.layer) {
			const {group, name} = options;

			const layer = imageCollection.registerLayer(null, {
				name,
				after:
					(uil.layers.length > 0 && uil.layers[uil.layers.length - 1].layer) ||
					bgLayer,
			});

			state.layer = {
				id: layer.id,
				group,
				name,
				deletable: options.deletable,
				_hidden: false,
				set hidden(v) {
					if (v) {
						this._hidden = true;
						this.layer.hide(v);
						this.entry && this.entry.classList.add("hidden");
					} else {
						this._hidden = false;
						this.layer.unhide(v);
						this.entry && this.entry.classList.remove("hidden");
					}
				},
				get hidden() {
					return this._hidden;
				},
				entry: null,
				layer,
			};
		}
		uil.layers.push(state.layer);

		uil._syncLayers();

		uil.active = state.layer;
	},
	(title, state) => {
		const index = uil.layers.findIndex((v) => v === state.layer);

		if (index === -1) throw new ReferenceError("Layer could not be found");

		if (uil.active === state.layer)
			uil.active = uil.layers[index + 1] || uil.layers[index - 1];
		uil.layers.splice(index, 1);
		uil._syncLayers();
	}
);

/**
 * Command for moving a layer to a position
 */
commands.createCommand(
	"moveLayer",
	(title, opt, state) => {
		const options = opt || {};
		defaultOpt(options, {
			layer: null,
			to: null,
			delta: null,
		});

		if (!state.layer) {
			if (options.to === null && options.delta === null)
				throw new Error(
					"[layers.moveLayer] Options must contain one of {to?, delta?}"
				);

			const layer = options.layer || uil.active;

			const index = uil.layers.indexOf(layer);
			if (index === -1) throw new ReferenceError("Layer could not be found");

			let position = options.to;

			if (position === null) position = index + options.delta;

			state.layer = layer;
			state.oldposition = index;
			state.position = position;
		}

		uil._moveLayerTo(state.layer, state.position);
	},
	(title, state) => {
		uil._moveLayerTo(state.layer, state.oldposition);
	}
);

/**
 * Command for deleting a layer
 */
commands.createCommand(
	"deleteLayer",
	(title, opt, state) => {
		const options = opt || {};
		defaultOpt(options, {
			layer: null,
		});

		if (!state.layer) {
			const layer = options.layer || uil.active;

			if (!layer.deletable)
				throw new TypeError("[layer.deleteLayer] Layer is not deletable");

			const index = uil.layers.indexOf(layer);
			if (index === -1)
				throw new ReferenceError(
					"[layer.deleteLayer] Layer could not be found"
				);

			state.layer = layer;
			state.position = index;
		}

		if (uil.active === state.layer)
			uil.active =
				uil.layers[state.position - 1] || uil.layers[state.position + 1];
		uil.layers.splice(state.position, 1);

		uil._syncLayers();

		state.layer.hidden = true;
	},
	(title, state) => {
		uil.layers.splice(state.position, 0, state.layer);
		uil.active = state.layer;

		uil._syncLayers();

		state.layer.hidden = false;
	}
);

/**
 * Command for merging a layer into the layer below it
 */
commands.createCommand(
	"mergeLayer",
	async (title, opt, state) => {
		const options = opt || {};
		defaultOpt(options, {
			layerS: null,
			layerD: null,
		});

		const layerS = options.layer || uil.active;

		if (!layerS.deletable)
			throw new TypeError(
				"[layer.mergeLayer] Layer is a root layer and cannot be merged"
			);

		const index = uil.layers.indexOf(layerS);
		if (index === -1)
			throw new ReferenceError("[layer.mergeLayer] Layer could not be found");

		if (index === 0 && !options.layerD)
			throw new ReferenceError(
				"[layer.mergeLayer] No layer below source layer exists"
			);

		// Use layer under source layer to merge into if not given
		const layerD = options.layerD || uil.layers[index - 1];

		state.layerS = layerS;
		state.layerD = layerD;

		// REFERENCE: This is a great reference for metacommands (commands that use other commands)
		// These commands should NOT record history as we are already executing a command
		state.drawCommand = await commands.runCommand(
			"drawImage",
			"Merge Layer Draw",
			{
				image: state.layerS.layer.canvas,
				x: 0,
				y: 0,
				ctx: state.layerD.layer.ctx,
			},
			{recordHistory: false}
		);
		state.delCommand = await commands.runCommand(
			"deleteLayer",
			"Merge Layer Delete",
			{layer: state.layerS},
			{recordHistory: false}
		);
	},
	(title, state) => {
		state.drawCommand.undo();
		state.delCommand.undo();
	},
	(title, options, state) => {
		state.drawCommand.redo();
		state.delCommand.redo();
	}
);

commands.runCommand(
	"addLayer",
	"Initial Layer Creation",
	{name: "Default Image Layer", deletable: false},
	{recordHistory: false}
);
