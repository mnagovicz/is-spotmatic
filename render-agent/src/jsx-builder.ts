import { RenderJob } from "./api-client";

interface JsxVariable {
  layerName: string;
  effectName: string;
  effectType: string;
  value: string | number;
}

interface JsxFootageReplacement {
  originalName: string;
  newFilePath: string;
}

export function buildJsx(
  job: RenderJob,
  aepPath: string,
  outputAepPath: string,
  outputMp4Path: string,
  footageReplacements: JsxFootageReplacement[]
): string {
  const variables: JsxVariable[] = [];

  // Map job data to variables
  for (const data of job.jobData) {
    const templateVar = job.template.variables.find((v) => v.id === data.key);
    if (templateVar) {
      let value: string | number = data.value;
      if (
        templateVar.effectType === "Slider" ||
        templateVar.type === "SLIDER"
      ) {
        value = parseFloat(data.value) || 0;
      } else if (
        templateVar.effectType === "Checkbox" ||
        templateVar.type === "CHECKBOX"
      ) {
        value = data.value === "1" ? 1 : 0;
      }
      variables.push({
        layerName: templateVar.layerName,
        effectName: templateVar.effectName,
        effectType: templateVar.effectType,
        value,
      });
    }
  }

  const escapePath = (p: string) => p.replace(/\\/g, "/");

  let jsx = `// Auto-generated ExtendScript for job ${job.id}
// Template: ${job.template.name}
// Generated: ${new Date().toISOString()}

(function() {
  // Helper: find composition by name
  function findComp(name) {
    for (var i = 1; i <= app.project.numItems; i++) {
      if (app.project.item(i) instanceof CompItem && app.project.item(i).name === name) {
        return app.project.item(i);
      }
    }
    return null;
  }

  // Helper: replace footage item
  function replaceFootage(originalName, newFilePath) {
    for (var i = 1; i <= app.project.numItems; i++) {
      var item = app.project.item(i);
      if (item instanceof FootageItem && item.name === originalName) {
        item.replace(new File(newFilePath));
        return true;
      }
    }
    return false;
  }

  // Helper: find layer in any composition
  function findLayerInComps(layerName) {
    for (var i = 1; i <= app.project.numItems; i++) {
      if (app.project.item(i) instanceof CompItem) {
        var comp = app.project.item(i);
        for (var j = 1; j <= comp.numLayers; j++) {
          if (comp.layer(j).name === layerName) {
            return comp.layer(j);
          }
        }
      }
    }
    return null;
  }

  try {
    // Open project
    app.open(new File("${escapePath(aepPath)}"));

`;

  // Set variables
  if (variables.length > 0) {
    // Text layers (Source Text)
    const textVars = variables.filter((v) => v.effectType === "Text");
    if (textVars.length > 0) {
      jsx += `    // Set text layer values\n`;
      for (const v of textVars) {
        const escaped = String(v.value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        jsx += `    var textLayer = findLayerInComps("${v.layerName}");
    if (textLayer) {
      try {
        var srcText = textLayer.property("ADBE Text Properties").property("ADBE Text Document");
        if (srcText) {
          var textDoc = srcText.value;
          textDoc.text = "${escaped}";
          srcText.setValue(textDoc);
        }
      } catch(e) {
        $.writeln("Warning: Could not set text on ${v.layerName}: " + e.message);
      }
    }\n\n`;
      }
    }

    // Effect controls (Slider, Checkbox, Color, etc.)
    const effectVars = variables.filter((v) => v.effectType !== "Text");
    if (effectVars.length > 0) {
      jsx += `    // Set controller values\n`;
      for (const v of effectVars) {
        const effectAccess =
          v.effectType === "Checkbox" ? "Checkbox" : "Slider";
        jsx += `    var layer = findLayerInComps("${v.layerName}");
    if (layer) {
      try {
        layer.effect("${v.effectName}")("${effectAccess}").setValue(${v.value});
      } catch(e) {
        $.writeln("Warning: Could not set ${v.effectName} on ${v.layerName}: " + e.message);
      }
    }\n\n`;
      }
    }
  }

  // Replace footage
  if (footageReplacements.length > 0) {
    jsx += `    // Replace footage items\n`;
    for (const fr of footageReplacements) {
      jsx += `    replaceFootage("${fr.originalName}", "${escapePath(fr.newFilePath)}");\n`;
    }
    jsx += `\n`;
  }

  // Save and render
  jsx += `    // Save modified project
    app.project.save(new File("${escapePath(outputAepPath)}"));

    // Add to render queue
    var exportComp = findComp("${job.template.exportCompName}");
    if (!exportComp) {
      throw new Error("Export composition '${job.template.exportCompName}' not found");
    }

    var rqItem = app.project.renderQueue.items.add(exportComp);
    rqItem.outputModule(1).file = new File("${escapePath(outputMp4Path)}");

    // Start render
    app.project.renderQueue.render();

    // Close project
    app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);

    // Quit
    app.quit();

  } catch(e) {
    $.writeln("ERROR: " + e.message);
    app.quit();
  }
})();
`;

  return jsx;
}
