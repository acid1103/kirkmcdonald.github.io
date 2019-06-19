import $ = require("jquery");
import { getImage } from "./icon";
import { solver } from "./init";
import { Matrix } from "./matrix";
import { MatrixSolver } from "./vectorize";

function getSolutionHeader(matrixSolver: MatrixSolver, costHeader: boolean) {
    const row = $("<tr>");
    row.append(
        ...matrixSolver.items.map((item) => $("<th>").text("s").append(getImage(item))),
        $("<th>").text("tax"),
        ...matrixSolver.recipes.map((obj) => $("<th>").append(getImage(obj))),
        $("<th>").text("answer"),
    );
    if (costHeader) { row.append($("<th>").text("C")); }
    return row;
}

function renderMatrix(matrixSolver: MatrixSolver, A: Matrix, rowIcons: boolean) {
    const table = $("<table>").prop("border", "1");
    const header = getSolutionHeader(matrixSolver, true);
    if (rowIcons) { header.prepend($("<th>")); }
    table.append(header);
    for (let j = 0; j < A.rows; j++) {
        const row = $("<tr>");
        table.append(row);
        if (rowIcons) {
            const td = $("<td>");
            if (j < matrixSolver.recipes.length) {
                const recipes = matrixSolver.recipes[j];
                td.append(getImage(recipes));
            } else if (j === A.rows - 2) {
                td.text("tax");
            } else if (j === A.rows - 1) {
                td.text("answer");
            }
            row.append(td);
        }
        for (let k = 0; k < A.cols; k++) {
            const cell = $("<td>").addClass("right-align");
            row.append(cell);
            const x = A.index(j, k);
            const tt = $("<tt>").text(x.toMixed());
            cell.append(tt);
        }
    }
    return table;
}

function renderDebug() {
    let node = $('<div id="matrixes">');
    $("#matrixes").replaceWith(node);

    solver.matrixSolvers.forEach((matrixSolver) => node.append(renderMatrix(matrixSolver, matrixSolver.matrix, true)));

    node = $('<div id="solution">');
    $("#solution").replaceWith(node);

    for (const matrixSolver of solver.matrixSolvers) {
        let A = matrixSolver.lastProblem;
        if (A) { node.append(renderMatrix(matrixSolver, A, false)); }

        A = matrixSolver.lastSolution;
        if (A) {
            // var basis = getBasis(A)
            const table = $("<table>").prop("border", "1");
            const row = $("<tr>");
            table.append(
                getSolutionHeader(matrixSolver, true),
                row,
            );
            for (let j = 0; j < A.cols; j++) {
                const cell = $("<td>").addClass("right-align");
                row.append(cell);
                // var x = basis[j]
                const x = A.index(A.rows - 1, j);
                const tt = $("<tt>").text(x.toDecimal(3));
                cell.append(tt);
            }
            node.append(table);
        }
    }
}

export {
    renderDebug,
};
