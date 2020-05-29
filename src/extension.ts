import * as vscode from "vscode";
import * as chokidar from "chokidar";
import * as fs from "fs";

let fileWatcher: chokidar.FSWatcher;

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(
    "liquidhaskell"
  );
  const currentPath = vscode.workspace.rootPath;

  fileWatcher = chokidar
    .watch(`${currentPath}/**/.liquid/*.json`)
    .on("all", (event, path) => {
      console.log("Modified .liquid folder", event, path);
      //   get file changed
      const filePath = path.replace(".liquid/", "").replace(".json", "");
      let diagnostics: vscode.Diagnostic[] = [];

      //   get file json content
      const fileContent = fs.readFileSync(path, { encoding: "utf8" });
      console.log("parsing", fileContent);
      const LHJsonReport = JSON.parse(fileContent);

      LHJsonReport.errors.forEach((error: any) => {
        const range: vscode.Range = new vscode.Range(
          error.start.line,
          error.start.column,
          error.stop.line,
          error.stop.column
        );
        diagnostics.push(
          new vscode.Diagnostic(
            range,
            error.message,
            vscode.DiagnosticSeverity.Error
          )
        );
      });
      if (LHJsonReport.status === "error") {
        diagnostics.push(
          new vscode.Diagnostic(
            new vscode.Range(0, 10, 0, 10),
            "Liquid Haskell fails on this file",
            vscode.DiagnosticSeverity.Error
          )
        );
      }
      diagnosticCollection.set(vscode.Uri.file(filePath), diagnostics);
    });
}

export function deactivate() {
  fileWatcher.close();
}
