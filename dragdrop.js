// ===============================================================================
// Drag And Drop module for CommandFusion
// Author: Florent Pillet, CommandFusion
// ===============================================================================

// the update rate for smooth movement
var FRAMES_PER_SECOND = 30;

// Drag manager global object
// ======================================================================
var DragManager = {
	drags: [],
	curDrag: null,
	lastDrag: null,
	
	// Call this function to add support from dragging one object onto another
	addDrag: function(draggedJoin, dropTarget, enterCallback, exitCallback, dropCallback) {
		for (var i=0, n=this.drags.length; i<n; i++) {
			if (this.drags[i].source.join == draggedJoin && this.drags[i].target.join == dropTarget) {
				// this combination is already registered
				return;
			}
		}
		var self=this;
		CF.getProperties(draggedJoin, function(srcProps) {
			CF.getProperties(dropTarget, function(dstProps) {
				self.drags.push({
					source: {join:draggedJoin, x:srcProps.x, y:srcProps.y, w:srcProps.w, h:srcProps.h, scale:srcProps.scale, opacity:srcProps.opacity},
					target: {join:dropTarget, x:dstProps.x, y:dstProps.y, w:dstProps.w, h: dstProps.h, scale:dstProps.scale, opacity: dstProps.opacity},
					enter: enterCallback,
					exit: exitCallback,
					drop: dropCallback
				});
			});
		});
	},

	// Call this function to remove one drag
	removeDrag: function(draggedJoin, dropTarget) {
		for (var i=0, n=this.drags.length; i<n; i++) {
			if (this.drags[i].source.join == draggedJoin && this.drags[i].target.join == dropTarget) {
				if (this.curDrag !== null && (this.curDrag.sourceIndex == i || this.curDrag.targetIndex == i)) {
					// cope with stupid things: removing a drag while something is in progress
					this.panGestureEnded(null);
				}
				this.drags.splice(i, 1);
				return;
			}
		}
	},
	
	// Call this function to remove all drags
	removeAllDrags: function() {
		// if a gesture is in progress, stop it now
		this.panGestureEnded(null);
		this.drags = [];
	},

	pointInBounds: function(x, y, target) {
		return (x>=target.x && x<(target.x+target.w) && y>=target.y && y<(target.y+target.h));
	},
	
	findTarget: function(gesture) {
		for (var i=this.drags.length-1; i>=0; i--) {
			if (this.drags[i].source.join == this.curDrag.join && this.pointInBounds(gesture.x, gesture.y, this.drags[i].target)) {
				return i;
			}
		}
		return -1;
	},
	
	enterTarget: function() {
		var idx = this.curDrag.targetIndex;
		if (idx >= 0) {
			var drop = this.drags[idx];
			if (drop.enter !== null) {
				// customized behavior: call enter callback, passing it
				// - the join string on the object being dragged
				// - the join string of the entered object
				drop.enter.apply(null, [ this.drags[this.curDrag.sourceIndex].source.join, drop.target.join ]);
			} else {
				// default behavior: scale up target object
				CF.setProperties({join:drop.target.join, scale:(drop.target.scale * 1.10)}, 0, 0.25);
			}
		}
	},

	exitTarget: function() {
		var idx = this.curDrag.targetIndex;
		if (idx >= 0) {
			var drop = this.drags[idx];
			if (drop.exit !== null) {
				// customized behavior: call exit callback, passing it:
				// - the join string on the object being dragged
				// - the join string of the exited object
				drop.exit.apply(null, [ this.drags[this.curDrag.sourceIndex].source.join, drop.target.join ]);
			} else {
				// default behavior: restore original scale
				CF.setProperties({join:drop.target.join, scale:drop.target.scale}, 0, 0.25);
			}
			this.curDrag.targetIndex = -1;
		}
	},
	
	updateDraggedObject: function(self) {
		// timer callback that moves the position of the object being dragged, as necessary,
		// and not more often than the planned FPS
		if (self.curDrag !== null && (self.curDrag.lastx != self.curDrag.x || self.curDrag.lasty != self.curDrag.y)) {
			CF.setProperties({join:self.curDrag.join, x:self.curDrag.x, y:self.curDrag.y});
		}
	},

	panGestureStarted: function(gesture) {
		CF.log("drags.length="+this.drags.length+",gesture.x="+gesture.x+",gesture.y="+gesture.y);
		this.panGestureEnded(null);
		for (var i=this.drags.length-1; i>=0; i--) {
			var src = this.drags[i].source;
			CF.log("srx.x="+src.x+",srx.y="+src.y+",srx.w="+src.w+",srx.h="+src.h);
			if (this.pointInBounds(gesture.x, gesture.y, src)) {
				CF.log("dragging " + src.join);
				this.curDrag = {
					join: src.join,
					sourceIndex: i,				// the index in drags of the currently dragged object (for fly back)
					targetIndex: -1,			// index in drags of the current dragSource/dropObject combination if the dragged object is over one of the registered objects
					x: src.x,					// the CURRENT position of object being dragged
					y: src.y,
					lastx: src.x,				// the LAST UPDATED position of object being dragged (last time the timer updated it)
					lasty: src.y,
					panx: gesture.x,			// the last received coordinates of the pan gesture
					pany: gesture.y,
					dx: (src.x - gesture.x),	// delta between the object's origin and the original gesture position
					dy: (src.y - gesture.y),
					opacity: Math.max(0.25, src.opacity / 2),
					timer: setInterval(this.updateDraggedObject, 1000 / FRAMES_PER_SECOND, this)
				};
				this.lastDrag = this.curDrag;
				CF.setProperties({join:src.join, opacity:this.curDrag.opacity}, 0, 0.25);
				return;
			}
		}
	},

	panGestureUpdated: function(gesture) {
		if (this.curDrag != null) {
			if (gesture.x != this.curDrag.panx || gesture.y != this.curDrag.pany) {
				this.curDrag.x = gesture.x + this.curDrag.dx;
				this.curDrag.y = gesture.y + this.curDrag.dy;
				this.curDrag.panx = gesture.x;
				this.curDrag.pany = gesture.y;
				var target = this.findTarget(gesture);
				if (target != this.curDrag.targetIndex) {
					this.exitTarget();
					this.curDrag.targetIndex = target;
					this.enterTarget();
				}
			}
		}
	},

	panGestureEnded: function(gesture) {
		if (this.curDrag !== null) {
			// drop the update timer
			clearInterval(this.curDrag.timer);
			
			// check whether we'll need to call a drop callback
			var drop = null;
			if (this.curDrag.targetIndex != -1) {
				if (gesture !== null) {
					drop = this.drags[this.curDrag.targetIndex];
				}
				//this.exitTarget();
			}

			// restore dragged object to original position. Drop callback can perform
			// additional processing
			var src = this.drags[this.curDrag.sourceIndex].source;

			if (drop === null) {
				// no destination:
				// smoothly move dragged object back to original position
				CF.setProperties({join:src.join, x:src.x, y:src.y, opacity:src.opacity}, 0, 0.5, CF.AnimationCurveEaseOut);
			} else {
				// destination found:
				// Nothing to do here, all animation must be handled via the drop callback
			}

			// order is important here. Since the final programmed callback may
			// do a removeDrag(), we first nullify the current drag to avoid a
			// recursive execution
			this.curDrag = null;

			// call the drop callback, passing it two parameters:
			// - the join of the object being dragged
			// - the join of the destination object
			if (drop !== null && drop.drop !== null) {
				drop.drop.apply(null, [ src.join, drop.target.join ]);
			}
		}
	}
};


// Callback functions for this partcular GUI
function dropTargetEntered(sourceJoin, targetJoin) {
	// A dragged object entered a drop target. Log info, and scale up the target
	CF.log("Drop target entered: source=" + sourceJoin + ", target=" + targetJoin);
	CF.setProperties({join:targetJoin, scale:1.2, opacity:1}, 0, 0.25);
}

function dropTargetExited(sourceJoin, targetJoin) {
	// A dragged object exited a drop target. Restore target scale and opacity
	var target = DragManager.drags[DragManager.curDrag.sourceIndex].target;
	CF.setProperties({join:targetJoin, scale:target.scale, opacity: target.opacity}, 0, 0.25);
}

function dropCompleted(sourceJoin, targetJoin) {
	// A drop was completed: TAKE ACTION HERE!
	var src = DragManager.drags[DragManager.lastDrag.sourceIndex].source;
	var target = DragManager.drags[DragManager.lastDrag.sourceIndex].target;

	// Make dragged object shrink to nothing
	CF.setProperties({join:src.join, scale: 0.0}, 0, 0.2, CF.AnimationCurveEaseOut, function() {
		// Return dragged object to original position and hide it
		CF.setProperties({join:src.join, x:src.x, y:src.y, opacity:0}, 0, 0, CF.AnimationCurveLinear, function() {
			// Fade in the dragged object at its original position
			CF.setProperties({join:src.join, opacity:src.opacity, scale:src.scale+0.1}, 0, 0.15, CF.AnimationCurveLinear, function() {
				CF.setProperties({join:src.join, scale:src.scale}, 0, 0.15);
			});
		});
	});

	CF.log("Drop COMPLETED: source=" + sourceJoin + ", target=" + targetJoin);
	// Make the target bounce to signify a valid drop
	CF.setProperties({join:targetJoin, scale:0.9}, 0, 0.15, CF.AnimationCurveLinear, function() {
		CF.setProperties({join:targetJoin, scale:1.1}, 0, 0.1, CF.AnimationCurveLinear, function() {
			CF.setProperties({join:targetJoin, scale:0.95}, 0, 0.08, CF.AnimationCurveLinear, function() {
				CF.setProperties({join:targetJoin, scale:1.0}, 0, 0.05, CF.AnimationCurveLinear, function() {
					// Always return to the original opacity and scale
					CF.setProperties({join:targetJoin, opacity:target.opacity, scale: target.scale}, 0, 0.3);
				});
			});
		});
	});
}

// userMain runs on startup.
// If you need to use multiple scripts,
// ensure only one script uses CF.userMain,
// combining all JS setup into this function.
// ======================================================================

CF.userMain = function() {
	CF.log("test");
	//CF.setProperties({join:"s2", opacity: 0}); 
	// Create a new drag that allows dragging object s1 onto object s2
	DragManager.addDrag("s1", "s2", dropTargetEntered, dropTargetExited, dropCompleted);
};
