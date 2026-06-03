Set WshShell = CreateObject("WScript.Shell")
scriptdir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run """" & scriptdir & "\dist\SymboLogic\SymboLogic.exe""", 0, False
