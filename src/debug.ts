import { getImage } from "./icon";
import { Matrix } from "./matrix";
import { MatrixSolver } from "./vectorize";
import { InitState } from "./window-interface";

function getSolutionHeader(matrixSolver: MatrixSolver, costHeader: boolean) {
    const row = document.createElement("tr");
    const items = matrixSolver.items;
    for (const item of items) {
        const currCell = document.createElement("th");
        currCell.appendChild(new Text("s"));
        currCell.appendChild(getImage(item));
        row.appendChild(currCell);
    }
    let cell = document.createElement("th");
    cell.appendChild(new Text("tax"));
    row.appendChild(cell);
    const recipes = matrixSolver.recipes;
    for (const obj of recipes) {
        const currCell = document.createElement("th");
        currCell.appendChild(getImage(obj));
        row.appendChild(currCell);
    }
    cell = document.createElement("th");
    cell.appendChild(new Text("answer"));
    row.appendChild(cell);
    if (costHeader) {
        const currCell = document.createElement("th");
        currCell.appendChild(new Text("C"));
        row.appendChild(currCell);
    }
    return row;
}

function renderMatrix(matrixSolver: MatrixSolver, A: Matrix, rowIcons: boolean) {
    const table = document.createElement("table");
    table.border = "1";
    const header = getSolutionHeader(matrixSolver, true);
    if (rowIcons) {
        header.insertBefore(document.createElement("th"), header.firstChild);
    }
    table.appendChild(header);
    for (let j = 0; j < A.rows; j++) {
        const row = document.createElement("tr");
        table.appendChild(row);
        if (rowIcons) {
            const td = document.createElement("td");
            if (j < matrixSolver.recipes.length) {
                const recipes = matrixSolver.recipes[j];
                td.appendChild(getImage(recipes));
            } else if (j === A.rows - 2) {
                td.appendChild(new Text("tax"));
            } else if (j === A.rows - 1) {
                td.appendChild(new Text("answer"));
            }
            row.appendChild(td);
        }
        for (let k = 0; k < A.cols; k++) {
            const cell = document.createElement("td");
            cell.classList.add("right-align");
            row.appendChild(cell);
            const x = A.index(j, k);
            const tt = document.createElement("tt");
            tt.textContent = x.toMixed();
            cell.appendChild(tt);
        }
    }
    return table;
}

function renderDebug() {
    const debugTab = document.getElementById("debug_tab");

    const oldMatrixes = document.getElementById("matrixes");
    let node = document.createElement("div");
    node.id = "matrixes";
    debugTab.replaceChild(node, oldMatrixes);

    for (const matrixSolver of InitState.solver.matrixSolvers) {
        const A = matrixSolver.matrix;
        const table = renderMatrix(matrixSolver, A, true);
        node.appendChild(table);
    }

    const oldSolutions = document.getElementById("solution");
    node = document.createElement("div");
    node.id = "solution";
    debugTab.replaceChild(node, oldSolutions);

    for (const matrixSolver of InitState.solver.matrixSolvers) {
        let A = matrixSolver.lastProblem;
        if (A) {
            const table = renderMatrix(matrixSolver, A, false);
            node.appendChild(table);
        }
        A = matrixSolver.lastSolution;
        if (A) {
            // var basis = getBasis(A)
            const table = document.createElement("table");
            table.border = "1";
            const header = getSolutionHeader(matrixSolver, true);
            table.appendChild(header);
            const row = document.createElement("tr");
            table.appendChild(row);
            for (let j = 0; j < A.cols; j++) {
                const cell = document.createElement("td");
                cell.classList.add("right-align");
                row.appendChild(cell);
                // var x = basis[j]
                const x = A.index(A.rows - 1, j);
                const tt = document.createElement("tt");
                tt.textContent = x.toDecimal(3);
                cell.appendChild(tt);
            }
            node.appendChild(table);
        }
    }
}

export {
    getSolutionHeader,
    renderMatrix,
    renderDebug,
};
