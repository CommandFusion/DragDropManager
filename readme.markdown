# Drag Drop Manager
Using the CommandFusion JavaScript API's, this Drag And Drop Manager allows you to define draggable objects by their join number, and drop targets in the same way.

You also define callbacks that get fired in certain Drag events:

	// Create a new drag that allows dragging object s1 onto object s2
	DragManager.addDrag("s1", "s2", dropTargetEntered, dropTargetExited, dropCompleted);