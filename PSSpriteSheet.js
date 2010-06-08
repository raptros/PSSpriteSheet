//places the next layer in the new PSD, writes the position and dimensions to the file
function moveLayerAndLog(layer, newX, posFile, destDoc, useVariableSpaces, defaultWidth)
{
    layer.translate(newX - layer.bounds[0], 0);
    var bounds = layer.bounds;
    var width = bounds[2] - bounds[0];
    var coords = "(" + bounds[0].value + ", " + bounds[1].value + ")";
    var size = "[" + (width.value) + "x" + (bounds[3].value - bounds[1].value) + "]";
    var bounds = "{" + bounds[0].value + ", " + bounds[1].value + ", " + bounds[2].value + ", " + bounds[3].value + "}";
    posFile.writeln(coords + " " + size + " " + bounds);
    if (!useVariableSpaces)
        width = defaultWidth;
    return newX + width;
}

//This function generates a new document,
//copies each layer from the source layer set into the new document,
//and figures out the width of the new document
function prepareDestDoc(sourceLS, sourceDoc, useVariableSpaces, name)
{
    var width = sourceLS.bounds[2] - sourceLS.bounds[0];
    var height = sourceLS.bounds[3] - sourceLS.bounds[1];
    
    var destDoc = documents.add(width, height, sourceDoc.resolution, name, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
  
    var newWidth = 0;
    
    for (var i=0; i < sourceLS.artLayers.length; i++)
    {
        var layer = sourceLS.artLayers[i];
        if (layer.visible)
        {
            activeDocument = sourceDoc;
            layer.copy();
            activeDocument = destDoc;
            destDoc.paste();
            if (useVariableSpaces)
                newWidth += (layer.bounds[2] - layer.bounds[0]);
        }
    }
    if (!useVariableSpaces)
        newWidth = sourceLS.artLayers.length * width;
    destDoc.resizeCanvas(newWidth, destDoc.height, AnchorPosition.TOPLEFT);
    return destDoc;
}

// saves doc as PSD in file
function saveDoc(doc, file)
{
    var saveOpt = new PhotoshopSaveOptions();
    doc.saveAs(file, saveOpt, false, Extension.LOWERCASE);
}

//generates a sprite sheet for a layer set - creates a new document, 
//names it based on the original document, logs the position information
//and stores the new document in the appropriate place.
function generateSheet(sourceLS, sourceDoc, baseLocation, baseName, posFile)
{

    var useVariableSpaces = Window.confirm("Do you want to let layers have variable spacing for the " + sourceLS.name + " sheet?",
            true, "Variable spacing?");

    var destDoc = prepareDestDoc(sourceLS, sourceDoc, useVariableSpaces, baseName + "-" + sourceLS.name + ".psd");
    posFile.writeln(destDoc.name);
    //have to make this a unit value for initial subtraction to work.
    var xpos = new UnitValue(0, "px");
    var defaultWidth = sourceLS.bounds[2] - sourceLS.bounds[0];


 	for (var i=(destDoc.artLayers.length - 1); i >= 0; i--) 
    {
        xpos = moveLayerAndLog(destDoc.artLayers[i], xpos, posFile, destDoc, useVariableSpaces, defaultWidth);
    }
    var destFile = new File(baseLocation + "/" + destDoc.name);
    saveDoc(destDoc, destFile);
}


//TODO: 
//ask for base location - done!
//ask how to size sheets. - done!
//generate xml output
//file type choosing
//conditional variable size for layers - done!

//New version! this one generates a spritesheet for each layer set (folder) of the document.
//It asks (soon) for the location to store the generated spritesheets, and has a single log
//file for positions and files of spritesheets from each folder.
function main()
{
	app.preferences.rulerUnits = Units.PIXELS;
    var sourceDoc = activeDocument;

    var base= sourceDoc.path.selectDlg();
    if (base == null)
        return ;
    var baseLocation = base.fsName;
    var baseName = sourceDoc.name.substring(0, sourceDoc.name.lastIndexOf("."));
    var posFile = new File(baseLocation + "/" + baseName + "-positions.txt", "TEXT");
    posFile.open("w");
    var count = sourceDoc.layerSets.length;

 	for (var i=0; i < count; i++) 
    {
        generateSheet(sourceDoc.layerSets[i], sourceDoc, baseLocation, baseName, posFile);
    }

    posFile.close();

}
main()
