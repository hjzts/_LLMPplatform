const defaultUrl = "https://coliru.stacked-crooked.com/compile";

let apiUrl = defaultUrl;
let wait = ((localStorageGetItem("wait") || "false") === "true");

let fontSize = 15;

let layout;

let sourceEditor;
let stdinEditor;
let stdoutEditor;
let $currentThemeId;

let currentLanguageId;

let $selectLanguage;
let $selectTheme;
let $compilerOptions;
let $commandLineArguments;
let $insertTemplateBtn;
let $runBtn;
let $saveBtn;
let $navigationMessage;
let $updates;
let $statusLine;

const layoutConfig = {
    settings: {
        showPopoutIcon: false,
        reorderEnabled: true
    },
    dimensions: {
        borderWidth: 3,
        headerHeight: 22
    },
    content: [{
        type: "column",
        content: [{
            type: "component",
            height: 71,
            componentName: "source",
            id: "source",
            title: "SOURCE",
            isClosable: false,
            componentState: {
                readOnly: false
            }
        }, {
            type: "stack",
            content: [{
                type: "component",
                componentName: "stdin",
                id: "stdin",
                title: "Input",
                isClosable: false,
                componentState: {
                    readOnly: false
                }
            }, {
                type: "component",
                componentName: "stdout",
                id: "stdout",
                title: "Output",
                isClosable: false,
                componentState: {
                    readOnly: true
                }
            }]
        }]
    }]
};


// 调用 main 函数，开始执行整个流程
function encode(str) {
    return btoa(unescape(encodeURIComponent(str || "")));
}

function decode(bytes) {
    const escaped = escape(atob(bytes || ""));
    try {
        return decodeURIComponent(escaped);
    } catch {
        return unescape(escaped);
    }
}

function localStorageSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (ignorable) {
    }
}

function localStorageGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (ignorable) {
        return null;
    }
}

function fontSizeAdd() {
    fontSize += 1;
    editorsUpdateFontSize(fontSize);
}

function fontSizeSub() {
    fontSize -= 1;
    editorsUpdateFontSize(fontSize);
}

function downloadSource() {
    const value = parseInt($selectLanguage.val());
    download(sourceEditor.getValue(), fileNames[value], "text/plain");
}

function newFile() {
    save();
    if (sourceEditor.getValue().localeCompare('') !== 0) {
        if (confirm("Are you sure? All Your current changes will be lost.")) {
            cleanAll();
        }
    }
}

function cleanAll() {
    currentLanguageId = parseInt($selectLanguage.val());
    if (currentLanguageId === 50) {
        localStorage.setItem('CSource', '');
        localStorage.setItem('CStdin', '');
    } else if (currentLanguageId === 54) {
        localStorage.setItem('CppSource', '');
        localStorage.setItem('CppStdin', '');
    } else if (currentLanguageId == 71) {
        localStorage.setItem('PySource', '');
        localStorage.setItem('PyStdin', '');
    }
    sourceEditor.setValue('');
    stdinEditor.setValue('');
    save();
}

/****************************** 处理输入输出运行结果 **************************/
function showError(title, content) {
    $("#site-modal #title").html(title);
    $("#site-modal .content").html(content);
    $("#site-modal").modal("show");
}

async function myRunPython(msg) {
    $runBtn.addClass("loading");
    stdoutEditor.setValue("");
    let pyodide = await loadPyodide();
    pyodide.runPython(`
    import sys
    from io import StringIO
    sys.stdout = StringIO()
    `);
    pyodide.runPython(msg);
    const stdout = pyodide.runPython("sys.stdout.getvalue()");
    console.log(stdout);
    // pyodide.runPythonAsync(msg);
    // var ret = await new Promise((resolve, reject) => {
    //     try {
    //         resolve(pyodide.runPython(msg));
    //     } catch (error) {
    //         reject(error);
    //     }
    // });
    const x = layout.root.getItemsById("stdout")[0];
    x.parent.header.parent.setActiveContentItem(x);
    stdoutEditor.setValue(stdout);
    $runBtn.removeClass("loading");
}

function run() {
    if (currentLanguageId === 71) {
        const msg = sourceEditor.getValue();
        myRunPython(msg);

    } else {
        if (sourceEditor.getValue().trim() === "") {
            showError("Error", "Source code can't be empty!");
            return;
        } else {
            $runBtn.addClass("loading");
        }

        document.getElementById("stdout-dot").hidden = true;

        stdoutEditor.setValue("");

        const x = layout.root.getItemsById("stdout")[0];
        x.parent.header.parent.setActiveContentItem(x);

        const sourceValue = (sourceEditor.getValue());
        const compilerOptions = "g++ -std=c++23  -O2 -Wall -Wextra -pedantic -pthread -pedantic-errors main.cpp -lm  -latomic  2>&1 | sed \"s/^//\"; if [ -x a.out ]; then ./a.out | sed \"s/^//\"; fi";

        const data = {
            src: sourceValue,
            cmd: compilerOptions,
        };

        const sendRequest = function (data) {
            const http = new XMLHttpRequest();
            http.open("POST", apiUrl, false);
            http.send(JSON.stringify(data));
            stdoutEditor.setValue(http.response);
            $runBtn.removeClass("loading");
        };
        sendRequest(data);
    }
}

/**************************** Other Setting ****************************/

function changeEditorLanguage() {
    monaco.editor.setModelLanguage(sourceEditor.getModel(), $selectLanguage.find(":selected").attr("mode"));
    currentLanguageId = parseInt($selectLanguage.val());
    $(".lm_title")[0].innerText = fileNames[currentLanguageId];
}

function insertTemplate() {
    console.log(currentLanguageId);
    currentLanguageId = parseInt($selectLanguage.val());
    sourceEditor.setValue(sources[currentLanguageId]);
    stdinEditor.setValue(inputs[currentLanguageId] || "");
    changeEditorLanguage();
    save();
}

function save() {
    console.log("save!");
    currentLanguageId = parseInt($selectLanguage.val());
    if (currentLanguageId === 50) {
        localStorage.setItem('CSource', sourceEditor.getValue());
        localStorage.setItem('CStdin', stdinEditor.getValue());
    } else if (currentLanguageId === 54) {
        localStorage.setItem('CppSource', sourceEditor.getValue());
        localStorage.setItem('CppStdin', stdinEditor.getValue());
    } else if (currentLanguageId == 71) {
        localStorage.setItem('PySource', sourceEditor.getValue());
        localStorage.setItem('PyStdin', stdinEditor.getValue());
    }
}

function saveOppo(lastLanguageId) {
    if (lastLanguageId === 50) {
        localStorage.setItem('CSource', sourceEditor.getValue());
        localStorage.setItem('CStdin', stdinEditor.getValue());
    } else if (lastLanguageId === 54) {
        localStorage.setItem('CppSource', sourceEditor.getValue());
        localStorage.setItem('CppStdin', stdinEditor.getValue());
    } else if (lastLanguageId == 71) {
        localStorage.setItem('PySource', sourceEditor.getValue());
        localStorage.setItem('PyStdin', stdinEditor.getValue());
    }
}

function insertBeforeWork() {
    currentLanguageId = parseInt($selectLanguage.val());
    if (currentLanguageId === 50 && localStorage.getItem('CSource') !== null) {
        sourceEditor.setValue(localStorage.getItem('CSource'));
        stdinEditor.setValue(localStorage.getItem('CStdin'));
    } else if (currentLanguageId === 54 && localStorage.getItem('CppSource') !== null) {
        sourceEditor.setValue(localStorage.getItem('CppSource'));
        stdinEditor.setValue(localStorage.getItem('CppStdin'));
    } else if (currentLanguageId == 71 && localStorage.getItem('PySource') !== null) {
        sourceEditor.setValue(localStorage.getItem('PySource'));
        stdinEditor.setValue(localStorage.getItem('PyStdin'));
    }
    changeEditorLanguage();
}

function loadLanguage() {
    $selectLanguage.dropdown("set selected", $selectLanguage[0].options[0].value);
    insertBeforeWork();
}

function updateTheme() {
    if (localStorage.getItem('Theme') !== null) {
        $currentThemeId = localStorage.getItem('Theme');
        let root = document.documentElement;
        root.className = $currentThemeId;
    }
}

function editorsUpdateFontSize(fontSize) {
    sourceEditor.updateOptions({fontSize: fontSize});
    stdinEditor.updateOptions({fontSize: fontSize});
    stdoutEditor.updateOptions({fontSize: fontSize});
}

function updateScreenElements() {
    const display = window.innerWidth <= 1200 ? "none" : "";
    $(".wide.screen.only").each(function () {
        $(this).css("display", display);
    });
    updateTheme();
}

$(window).resize(function () {
    layout.updateSize();
    updateScreenElements();
});

$(document).ready(function () {
    updateScreenElements();

    $selectLanguage = $("#select-language");
    let lastLanguageId = $selectLanguage.val();
    $selectLanguage.change(function () {
        saveOppo(lastLanguageId);
        insertBeforeWork();
    });
    $selectTheme = $("#select-theme");
    $selectTheme.change(function () {
        console.log($selectTheme);
        localStorage.setItem('Theme', $selectTheme.val());
        updateTheme();
    });

    $compilerOptions = $("#compiler-options");
    $commandLineArguments = $("#command-line-arguments");
    $commandLineArguments.attr("size", $commandLineArguments.attr("placeholder").length);

    $insertTemplateBtn = $("#insert-template-btn");
    $insertTemplateBtn.click(function () {
        if (confirm("Are you sure? Your current changes will be lost.")) {
            insertTemplate();
        }
    });

    $saveBtn = $("#save-btn");
    $saveBtn.click(function () {
        save();
        alert("Save successfully!");
    });

    $(document).on("keydown", function (e) {
        const keycode = e.keyCode || e.which;
        if (e.ctrlKey && keycode === 83) {
            e.preventDefault();
            save();
            alert("Save successfully!");
        }
    });

    if (!/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
        $("#run-btn-label").html("Run (Ctrl + ↵)");
    }

    $runBtn = $("#run-btn");
    $runBtn.click(function () {
        save();
        run();
    });

    $navigationMessage = $("#navigation-message span");
    $updates = $("#judge0-more");

    $statusLine = $("#status-line");

    $(document).on("keydown", "body", function (e) {
        const keyCode = e.keyCode || e.which;
        if ((e.metaKey || e.ctrlKey) && keyCode === 13) { // Ctrl + Enter, CMD + Enter
            e.preventDefault();
            save();
            run();
        } else if (keyCode === 119) { // F8
            e.preventDefault();
            let url = prompt("Enter base URL:", apiUrl);
            if (url != null) {
                url = url.trim();
            }
            if (url != null && url !== "") {
                apiUrl = url;
                localStorageSetItem("api-url", apiUrl);
            }
        } else if (keyCode === 118) { // F7
            e.preventDefault();
            wait = !wait;
            localStorageSetItem("wait", wait);
            alert(`Submission wait is ${wait ? "ON. Enjoy" : "OFF"}.`);
        } else if (e.ctrlKey && keyCode === 107) { // Ctrl++
            e.preventDefault();
            fontSize += 1;
            editorsUpdateFontSize(fontSize);
        } else if (e.ctrlKey && keyCode === 109) { // Ctrl+-
            e.preventDefault();
            fontSize -= 1;
            editorsUpdateFontSize(fontSize);
        } else if (e.ctrlKey && keyCode === 82) { // Ctrl + R
            e.preventDefault();
            if (confirm("Are you sure? Your current changes will be lost.")) {
                insertTemplate();
            }
        }
    });

    $("select.dropdown").dropdown();
    $(".ui.dropdown").dropdown();
    $(".ui.dropdown.site-links").dropdown({action: "hide", on: "hover"});
    $(".ui.checkbox").checkbox();
    $(".message .close").on("click", function () {
        $(this).closest(".message").transition("fade");
    });

    require(["vs/editor/editor.main"], function () {
        layout = new GoldenLayout(layoutConfig, $("#site-content"));

        layout.registerComponent("source", function (container, state) {
            sourceEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                theme: "vs-dark",
                scrollBeyondLastLine: true,
                readOnly: state.readOnly,
                language: "cpp",
                minimap: {
                    enabled: true
                }
            });

            sourceEditor.getModel().onDidChangeContent(function () {
                currentLanguageId = parseInt($selectLanguage.val());
            });

            sourceEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);
        });

        layout.registerComponent("stdin", function (container, state) {
            stdinEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                theme: "vs-dark",
                scrollBeyondLastLine: false,
                readOnly: state.readOnly,
                language: "plaintext",
                minimap: {
                    enabled: false
                }
            });
        });

        layout.registerComponent("stdout", function (container, state) {
            stdoutEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                theme: "vs-dark",
                scrollBeyondLastLine: false,
                readOnly: state.readOnly,
                language: "plaintext",
                minimap: {
                    enabled: false
                }
            });

            container.on("tab", function (tab) {
                tab.element.append("<span id=\"stdout-dot\" class=\"dot\" hidden></span>");
                tab.element.on("mousedown", function (e) {
                    e.target.closest(".lm_tab").children[3].hidden = true;
                });
            });
        });

        layout.on("initialised", function () {
            $(".monaco-editor")[0].appendChild($("#editor-status-line")[0]);
            loadLanguage();
            $("#site-navigation").css("border-bottom", "1px solid black");
            sourceEditor.focus();
            editorsUpdateFontSize(fontSize);
        });

        layout.init();
    });
});

// Template Sources
const pySource = "\
print(\"hello world\")\n\
";

const cSource = "\
#include <stdio.h>\n\
\n\
int main(void) \n\
{\n\
    printf(\"Hello World!\\n\");\n\
    return 0;\n\
}\n\
";


const competitiveProgrammingSource = "\
#include <algorithm>\n\
#include <cstdint>\n\
#include <iostream>\n\
#include <limits>\n\
#include <set>\n\
#include <utility>\n\
#include <vector>\n\
\n\
using Vertex    = std::uint16_t;\n\
using Cost      = std::uint16_t;\n\
using Edge      = std::pair< Vertex, Cost >;\n\
using Graph     = std::vector< std::vector< Edge > >;\n\
using CostTable = std::vector< std::uint64_t >;\n\
\n\
constexpr auto kInfiniteCost{ std::numeric_limits< CostTable::value_type >::max() };\n\
\n\
auto dijkstra( Vertex const start, Vertex const end, Graph const & graph, CostTable & costTable )\n\
{\n\
    std::fill( costTable.begin(), costTable.end(), kInfiniteCost );\n\
    costTable[ start ] = 0;\n\
\n\
    std::set< std::pair< CostTable::value_type, Vertex > > minHeap;\n\
    minHeap.emplace( 0, start );\n\
\n\
    while ( !minHeap.empty() )\n\
    {\n\
        auto const vertexCost{ minHeap.begin()->first  };\n\
        auto const vertex    { minHeap.begin()->second };\n\
\n\
        minHeap.erase( minHeap.begin() );\n\
\n\
        if ( vertex == end )\n\
        {\n\
            break;\n\
        }\n\
\n\
        for ( auto const & neighbourEdge : graph[ vertex ] )\n\
        {\n\
            auto const & neighbour{ neighbourEdge.first };\n\
            auto const & cost{ neighbourEdge.second };\n\
\n\
            if ( costTable[ neighbour ] > vertexCost + cost )\n\
            {\n\
                minHeap.erase( { costTable[ neighbour ], neighbour } );\n\
                costTable[ neighbour ] = vertexCost + cost;\n\
                minHeap.emplace( costTable[ neighbour ], neighbour );\n\
            }\n\
        }\n\
    }\n\
\n\
    return costTable[ end ];\n\
}\n\
\n\
int main()\n\
{\n\
    constexpr std::uint16_t maxVertices{ 10000 };\n\
\n\
    Graph     graph    ( maxVertices );\n\
    CostTable costTable( maxVertices );\n\
\n\
    std::uint16_t testCases;\n\
    std::cin >> testCases;\n\
\n\
    while ( testCases-- > 0 )\n\
    {\n\
        for ( auto i{ 0 }; i < maxVertices; ++i )\n\
        {\n\
            graph[ i ].clear();\n\
        }\n\
\n\
        std::uint16_t numberOfVertices;\n\
        std::uint16_t numberOfEdges;\n\
\n\
        std::cin >> numberOfVertices >> numberOfEdges;\n\
\n\
        for ( auto i{ 0 }; i < numberOfEdges; ++i )\n\
        {\n\
            Vertex from;\n\
            Vertex to;\n\
            Cost   cost;\n\
\n\
            std::cin >> from >> to >> cost;\n\
            graph[ from ].emplace_back( to, cost );\n\
        }\n\
\n\
        Vertex start;\n\
        Vertex end;\n\
\n\
        std::cin >> start >> end;\n\
\n\
        auto const result{ dijkstra( start, end, graph, costTable ) };\n\
\n\
        if ( result == kInfiniteCost )\n\
        {\n\
            std::cout << \"NO\\n\";\n\
        }\n\
        else\n\
        {\n\
            std::cout << result << '\\n';\n\
        }\n\
    }\n\
\n\
    return 0;\n\
}\n\
";

var sources = {
    50: cSource,
    54: competitiveProgrammingSource,
    71: pySource
};

var fileNames = {
    50: "main.c",
    54: "main.cpp",
    71: "main.py"
};


const competitiveProgrammingInput = "\
3\n\
3 2\n\
1 2 5\n\
2 3 7\n\
1 3\n\
3 3\n\
1 2 4\n\
1 3 7\n\
2 3 1\n\
1 3\n\
3 1\n\
1 2 4\n\
1 3\n\
";

var inputs = {
    54: competitiveProgrammingInput
}