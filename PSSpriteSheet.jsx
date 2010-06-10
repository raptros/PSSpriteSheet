function prop(name, value) { return name + "=\"" + value + "\""; }

//generate a sprite node.
function spriteString(x, y, w, h, name)
{
    return "<sprite" + " " + prop("name", name)
                    + " " + prop("x", x)
                    + " " + prop("y", y)
                    + " " + prop("w", w)
                    + " " + prop("h", h)
                    + " />";

}

function sheetString(sheet)
{
    return "<sheet" + " " + prop("name", sheet.name)
                    + " " + prop("src", sheet.longName + sheet.esuffix)
                    + " " + prop("w", sheet.doc.width.value)
                    + " " + prop("h", sheet.doc.height.value)
                    + ">";

}

function closeSheet() { return "</sheet>";}

//This represents a sheet object - it has some locations and naming stuff, export options, and source layers
//cycle: createDoc, layout, saveAndExport
function Sheet(posFile, baseLocation, baseName, opts, sourceLS)
{
    this.posFile = posFile;
    this.baseLoc = baseLocation;
    this.baseName = baseName;
    this.opts = opts;
    this.doc = null;
    this.sourceLS = sourceLS;
    this.name = sourceLS.name;
    this.longName = this.baseName + "-" + this.name

    this.esuffix = ".png";
    if (this.opts.format == SaveDocumentType.JPEG)
        this.esuffix = ".jpg";
    else if (this.opts.format == SaveDocumentType.COMPUSERVEGIF)
        this.esuffix = ".gif";

    this.useVariableSpaces = Window.confirm("Do you want to let layers have variable spacing for the " + this.name + " sheet?",
            true, "Variable spacing?");

    // saves doc as PSD in file, and exports images of aprropriate type
    this.saveAndExport = function()
    {
        var exportFile = new File(this.baseLoc+ "/" + this.longName + this.esuffix);
        this.doc.exportDocument(exportFile, ExportType.SAVEFORWEB, this.opts);

        var destFile = new File(this.baseLoc+ "/" + this.longName + ".psd");
        var saveOpt = new PhotoshopSaveOptions();
        this.doc.saveAs(destFile, saveOpt, false, Extension.LOWERCASE);
    }

    //This function generates a new document,
    //copies each layer from the source layer set into the new document,
    //and figures out the width of the new document
    this.createDoc = function(sourceDoc)
    {
        var sourceLS = this.sourceLS;
        //create a new document that the layers can be copied to.
        var width = sourceLS.bounds[2] - sourceLS.bounds[0];
        var height = sourceLS.bounds[3] - sourceLS.bounds[1];
        
        this.doc = documents.add(width, height, sourceDoc.resolution, this.longName,
                                NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
      
        var newWidth = 0;
        //for every visible layer in the layer set, copy the layer over to the new document,
        //and (if in variable space mode) sum up the widths.
        for (var i=0; i < sourceLS.artLayers.length; i++)
        {
            var layer = sourceLS.artLayers[i];
            if (layer.visible)
            {
                //the requirement that the active doc be switched is irritating, I know.
                activeDocument = sourceDoc;
                layer.copy();
                activeDocument = this.doc;
                //we want to keep the original layer names. Yes, this does exactly that.
                this.doc.paste().name = layer.name;
                if (this.useVariableSpaces)
                    newWidth += (layer.bounds[2] - layer.bounds[0]);
            }
        }
        if (!this.useVariableSpaces)
            newWidth = sourceLS.artLayers.length * width;
        this.doc.resizeCanvas(newWidth, this.doc.height, AnchorPosition.TOPLEFT);
    }

    //lays out the layers of the spritesheet, logs information
    this.layout = function(indent)
    {
        var xpos = new UnitValue(0, "px"); //have to make this a unit value for initial subtraction to work.
        var sourceLS = this.sourceLS;

        //used for non-variable spacing mode:
        this.defWidth = sourceLS.bounds[2] - sourceLS.bounds[0]; 
        this.defHeight = sourceLS.bounds[3] - sourceLS.bounds[1];

        this.posFile.writeln(indent + sheetString(this));
        var indent2 = indent+indent;
        //this loop moves each layer 
        for (var i=0; i < this.doc.artLayers.length; i++) 
        {
            xpos = this.moveLayer(this.doc.artLayers[i], xpos, indent2);
        }
        this.posFile.writeln(indent + closeSheet());
    }

    //places the next layer in the new PSD, writes the position and dimensions to the file
    this.moveLayer = function(layer, newX, indent)
    {
        //place object all the way to the top left of the available space
        //remember that translate is relative to the current position of the layer.
        var negativeY = new UnitValue(-layer.bounds[1], "px");
        layer.translate(newX - layer.bounds[0], negativeY);
        
        //obtain the current dimensions and position of the layer.
        var x = layer.bounds[0];
        var width = layer.bounds[2] - x;
        var y = layer.bounds[1];
        var height = layer.bounds[3] - y;

        //If spacing is variable, then sprite is located properly.
        //Otherwise, center the sprite, and use the default sizes.
        if (!this.useVariableSpaces)
        {
            var xoffset = (this.defWidth - width) * 0.5;
            var yoffset = (this.defHeight - height) * 0.5;
            layer.translate(xoffset, yoffset);
            width = this.defWidth;
            height = this.defHeight;
        }

        this.posFile.writeln(indent +
                spriteString(x.value, y.value, width.value, height.value, layer.name));

        //update the x position.
        return newX + width;
    }

}

//Brings up a dialog asking about how export should be done.
function getFormatOpts()
{
    //The dialog is built using a resource string.
    var dia = new Window(
            "dialog { \
                info : Panel { orientation: 'column', alignChildren: 'right', \
                    text: 'Options', \
                    format : Group { orientation: 'row', \
                        prompter : StaticText { text: 'What format to export in?'}, \
                        chooser : DropDownList { alignment: 'left' } \
                    },\
                    pngOpts: Group { orientation: 'row', \
                        typeCheck: Checkbox { text: 'Use PNG24 instead of PNG8.' }\
                    },\
                    jpgOpts: Group { orientation: 'row' \
                    },\
                    gifOpts: Group { orientation: 'row' \
                    }\
                }, \
                buttons: Group { orientation: 'row', \
                    okBtn: Button { text:'OK', properties:{name:'ok'}},  \
                    cancelBtn: Button { text:'Cancel', properties:{name:'cancel'}} \
                } \
             }" );
    // this allows only option groups for the chosen format to be shown
    dia.info.format.chooser.onChange = function ()
    {
        if (this.selection != null) 
        {
            for (var g = 0; g < this.items.length; g++)
                this.items[g].group.visible = false; //hide all other groups
            this.selection.group.visible = true;//show this group
        }
    }
    //formats that can be exported to, and their options
    var item = dia.info.format.chooser.add("item", "PNG");
    item.group = dia.info.pngOpts;
    item = dia.info.format.chooser.add("item", "JPEG");
    item.group = dia.info.jpgOpts;
    item = dia.info.format.chooser.add("item", "GIF");
    item.group = dia.info.gifOpts;
    dia.info.format.chooser.selection = dia.info.format.chooser.items[0];
    dia.center();
    result = dia.show();
    if (result == 1)
    {
        //generate the options object using the results from the dialog.
        var exportOpts = new ExportOptionsSaveForWeb();
        switch (dia.info.format.chooser.selection.index)
        {
            case 0:
                exportOpts.format = SaveDocumentType.PNG;
                exportOpts.PNG8 = !dia.info.pngOpts.typeCheck.value;
                break;
            case 1:
                exportOpts.format = SaveDocumentType.JPEG;
                break;
            case 2:
                exportOpts.format = SaveDocumentType.COMPUSERVEGIF;
                break;
        }
        return exportOpts;
    }
    else
        return null;
}


//New version! this one generates a spritesheet for each layer set (folder) of the document.
//It asks for the location to store the generated spritesheets, and has a single log
//file for positions and files of spritesheets from each folder.
function main()
{
	app.preferences.rulerUnits = Units.PIXELS;
    var sourceDoc = activeDocument;

    //get options for exporting each generated sheet to PNG
    opts = getFormatOpts();
    if (opts == null)
        return ;

    //find out where to store everything.
    var base= sourceDoc.path.selectDlg();
    if (base == null)
        return ;
    var baseLocation = base.fsName;
    var baseName = sourceDoc.name.substring(0, sourceDoc.name.lastIndexOf("."));

    //text file stores positions of sprites in the sheets.
    var posFile = new File(baseLocation + "/" + baseName + "-positions.xml", "TEXT");
    posFile.open("w");
    posFile.encoding = "UTF-8";
    posFile.writeln("<?xml version=\"1.0\" encoding=\"UTF-8\" ?>");

    posFile.writeln("<positions " + prop("name", baseName) + " >");

    var sheet;
    var indent = "    ";

    //loop over each folder, generating sheets.
    var count = sourceDoc.layerSets.length;
 	for (var i=0; i < count; i++) 
    {
        sheet = new Sheet(posFile, baseLocation, baseName, opts, sourceDoc.layerSets[i]);
        sheet.createDoc(sourceDoc);
        sheet.layout(indent);
        sheet.saveAndExport();
    }
    
    posFile.writeln("</positions>");
    posFile.close();

}
main()
