import * as vscode from "vscode";
import * as chokidar from "chokidar";
import * as fs from "fs";

let fileWatcher: chokidar.FSWatcher;
let terminal: vscode.Terminal;
let configuration = vscode.workspace.getConfiguration("liquidhaskell");

export function activate(context: vscode.ExtensionContext) {
  registerDiagnostics(context);
  registerCommands(context);
  // update configuration on change
  vscode.workspace.onDidChangeConfiguration(() => {
    configuration = vscode.workspace.getConfiguration("liquidhaskell");
  });
}
export function deactivate() {
  fileWatcher.close();
}

function registerCommands(context: vscode.ExtensionContext) {
  const command = "liquidhaskell.runLiquid";
  const liquidCommand = configuration.get("command");

  // register on save

  vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId === "haskell" && configuration.get("runOnSave")) {
      vscode.commands.executeCommand(command);
    }
  });

  const commandHandler = () => {
    const currentOpenFile = vscode.window.activeTextEditor?.document.fileName;
    if (currentOpenFile) {
      const message = vscode.window.setStatusBarMessage(
        "Running LiquidHaskell on " + currentOpenFile.replace(/^.*[\\\/]/, "")
      );
      if (!terminal) {
        terminal = vscode.window.createTerminal("LiquidHaskell");
      }
      if (configuration.get("showTerminalOnRun")) {
        terminal.show();
      }
      terminal.sendText(`${liquidCommand} ${currentOpenFile}`);
      message.dispose();
    } else {
      vscode.window.showErrorMessage(
        "LiquidHaskell-diagnostics: No haskell file currently opened"
      );
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(command, commandHandler)
  );
}

function registerDiagnostics(contest: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(
    "liquidhaskell"
  );
  const currentPath = vscode.workspace.rootPath;

  fileWatcher = chokidar
    .watch(`${currentPath}/**/.liquid/*.json`)
    .on("all", async (event, path) => {
      console.log("Modified .liquid folder", event, path);
      //   get file changed
      const filePath = path.replace(".liquid/", "").replace(".json", "");
      let diagnostics: vscode.Diagnostic[] = [];

      //   get file json content
      const fileContent = fs.readFileSync(path, { encoding: "utf8" });
      let LHJsonReport = undefined;
      // LH writes multiple times to the same file, parsing might fail during middle writes
      while (!LHJsonReport) {
        try {
          LHJsonReport = JSON.parse(fileContent);
        } catch (e) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

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
