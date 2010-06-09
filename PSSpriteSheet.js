//places the next layer in the new PSD, writes the position and dimensions to the file
function moveLayerAndLog(layer, newX, posFile, destDoc, useVariableSpaces, defWidth, defHeight)
{
    //place object all the way to the top left of the available space
    //remember that translate is relative to the current position of the layer.
    var negativeY = new UnitValue(-layer.bounds[1], "px");
    layer.translate(newX - layer.bounds[0], negativeY);
    
    //obtain the current dimensions and position of the layer.
    var x = layer.bounds[0];
    var width = layer.bounds[2] - x;
    var y = layer.bounds[1]
    var height = layer.bounds[3] - y;

    //If spacing is variable, then sprite is located properly.
    //Otherwise, center the sprite, and use the default sizes.
    if (!useVariableSpaces)
    {
        var xoffset = (defWidth - width) * 0.5;
        var yoffset = (defHeight - height) * 0.5;
        layer.translate(xoffset, yoffset);
        width = defWidth;
        height = defHeight;
    }

    //Then, log the current x, y, width, height. this will become some kind of XML info.
    var coords = "(" + x.value + ", " + y.value + ")";
    var size = "[" + width.value + "x" + height.value + "]";
    var bounds = "{" + layer.bounds[0].value + ", " + layer.bounds[1].value +
        ", " + layer.bounds[2].value + ", " + layer.bounds[3].value + "}";
    posFile.writeln(coords + " " + size + " " + bounds);

    //update the x position.
    return newX + width;
}

//This function generates a new document,
//copies each layer from the source layer set into the new document,
//and figures out the width of the new document
function prepareDestDoc(sourceLS, sourceDoc, useVariableSpaces, name)
{
    //create a new document that the layers can be copied to.
    var width = sourceLS.bounds[2] - sourceLS.bounds[0];
    var height = sourceLS.bounds[3] - sourceLS.bounds[1];
    
    var destDoc = documents.add(width, height, sourceDoc.resolution, name, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
  
    var newWidth = 0;
    //for every visible layer in the layer set,
    //copy the layer over to the new document,
    //and (if in variable space mode) sum up the widths.
    for (var i=0; i < sourceLS.artLayers.length; i++)
    {
        var layer = sourceLS.artLayers[i];
        if (layer.visible)
        {
            //the requirement that the active doc be switched is irritating, I know.
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



//generates a sprite sheet for a layer set - creates a new document, 
//names it based on the original document, logs the position information
//and returns the generated sheet.
function generateSheet(sourceLS, sourceDoc, baseLocation, baseName, posFile)
{
    var useVariableSpaces = Window.confirm("Do you want to let layers have variable spacing for the " + sourceLS.name + " sheet?",
            true, "Variable spacing?");
    var destDoc = prepareDestDoc(sourceLS, sourceDoc, useVariableSpaces, baseName + "-" + sourceLS.name);
    posFile.writeln(destDoc.name);

    var xpos = new UnitValue(0, "px"); //have to make this a unit value for initial subtraction to work.

    //used for non-variable spacing mode:
    var defWidth = sourceLS.bounds[2] - sourceLS.bounds[0]; 
    var defHeight = sourceLS.bounds[3] - sourceLS.bounds[1];

    //this loop moves each layer 
 	for (var i=0; i <destDoc.artLayers.length; i++) 
    {
        xpos = moveLayerAndLog(destDoc.artLayers[i], xpos, posFile, destDoc, useVariableSpaces, defWidth, defHeight);
    }
    return destDoc;
}


//TODO: 
//generate xml output

//Brings up a dialog asking about how export should be done.
function getPNGOpts()
{
    var dia = new Window(
            "dialog { \
                info : Panel { orientation: 'column', alignChildren: 'right', \
                    text: 'Options', \
                    formatType: Group { orientation: 'row', \
                        formatCheck: Checkbox { text: 'Use PNG24 instead of PNG?' }\
                    }\
                }, \
                buttons: Group { orientation: 'row', \
                    okBtn: Button { text:'OK', properties:{name:'ok'}},  \
                    cancelBtn: Button { text:'Cancel', properties:{name:'cancel'}} \
                } \
             }" );
    dia.center();
    result = dia.show();
    if (result == 1)
    {
        var exportOpts = new ExportOptionsSaveForWeb();
        exportOpts.format = SaveDocumentType.PNG;
        exportOpts.PNG8 = !dia.info.formatType.formatCheck.value;
        return exportOpts;
    }
    else
        return null;
}

// saves doc as PSD in file, and exports pngs
function saveAndExportSheet(doc, baseLocation, exportOpts)
{
    var exportFile = new File(baseLocation + "/" + doc.name + ".png");
    doc.exportDocument(exportFile, ExportType.SAVEFORWEB, exportOpts);

    var destFile = new File(baseLocation + "/" + doc.name + ".psd");
    var saveOpt = new PhotoshopSaveOptions();
    doc.saveAs(destFile, saveOpt, false, Extension.LOWERCASE);
}

//New version! this one generates a spritesheet for each layer set (folder) of the document.
//It asks for the location to store the generated spritesheets, and has a single log
//file for positions and files of spritesheets from each folder.
function main()
{
	app.preferences.rulerUnits = Units.PIXELS;
    var sourceDoc = activeDocument;

    //get options for exporting each generated sheet to PNG
    opts = getPNGOpts();
    if (opts == null)
        return ;

    //find out where to store everything.
    var base= sourceDoc.path.selectDlg();
    if (base == null)
        return ;
    var baseLocation = base.fsName;
    var baseName = sourceDoc.name.substring(0, sourceDoc.name.lastIndexOf("."));

    //text file stores positions of sprites in the sheets.
    var posFile = new File(baseLocation + "/" + baseName + "-positions.txt", "TEXT");
    posFile.open("w");

    var sheet;

    //loop over each folder, generating sheets.
    var count = sourceDoc.layerSets.length;
 	for (var i=0; i < count; i++) 
    {
        sheet = generateSheet(sourceDoc.layerSets[i], sourceDoc, baseLocation, baseName, posFile);
        saveAndExportSheet(sheet, baseLocation, opts);
    }

    posFile.close();

}
main()
