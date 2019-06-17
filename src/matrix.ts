import {
    one,
    Rational,
    zero,
} from "./rational";

// An MxN matrix of rationals.
export class Matrix {
    public rows: number;
    public cols: number;
    public mat: Rational[];

    constructor(rows: number, cols: number, mat?: Rational[]) {
        this.rows = rows;
        this.cols = cols;
        if (mat) {
            this.mat = mat;
        } else {
            this.mat = [];
            for (let i = 0; i < rows * cols; i++) {
                this.mat.push(zero);
            }
        }
    }

    public toString() {
        const widths = [];
        for (let i = 0; i < this.cols; i++) {
            let width = 0;
            for (let j = 0; j < this.rows; j++) {
                const s = this.index(j, i).toDecimal(3);
                if (s.length > width) {
                    width = s.length;
                }
            }
            widths.push(width);
        }
        const lines = [];
        for (let i = 0; i < this.rows; i++) {
            const line = [];
            for (let j = 0; j < this.cols; j++) {
                let s = this.index(i, j).toDecimal(3); // .padStart(widths[j]);
                const padding = new Array(widths[j]).fill(" ").join("");
                s = padding + s;
                line.push(s);
            }
            lines.push(line.join(" "));
        }
        return lines.join("\n");
    }

    public copy() {
        const mat = this.mat.slice();
        return new Matrix(this.rows, this.cols, mat);
    }

    public index(row: number, col: number) {
        return this.mat[row * this.cols + col];
    }

    public setIndex(row: number, col: number, value: Rational) {
        this.mat[row * this.cols + col] = value;
    }

    public addIndex(row: number, col: number, value: Rational) {
        this.setIndex(row, col, this.index(row, col).add(value));
    }

    // Multiplies all positive elements of a column by the value, in-place.
    // (For prod modules.)
    public mulPosColumn(col: number, value: Rational) {
        for (let i = 0; i < this.rows; i++) {
            const x = this.index(i, col);
            if (x.less(zero) || x.equal(zero)) {
                continue;
            }
            this.setIndex(i, col, x.mul(value));
        }
    }

    public mulRow(row: number, value: Rational) {
        for (let i = 0; i < this.cols; i++) {
            const x = this.index(row, i);
            this.setIndex(row, i, x.mul(value));
        }
    }

    public appendColumn(column: Rational[]) {
        const mat = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                mat.push(this.index(i, j));
            }
            mat.push(column[i]);
        }
        return new Matrix(this.rows, this.cols + 1, mat);
    }

    // Returns new matrix with given number of additional columns.
    public appendColumns(n: number) {
        const mat = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                mat.push(this.index(i, j));
            }
            for (let j = 0; j < n; j++) {
                mat.push(zero);
            }
        }
        return new Matrix(this.rows, this.cols + n, mat);
    }

    public setColumn(j: number, column: Rational[]) {
        for (let i = 0; i < this.rows; i++) {
            this.setIndex(i, j, column[i]);
        }
    }

    // Sets a column to all zeros.
    public zeroColumn(col: number) {
        for (let i = 0; i < this.rows; i++) {
            this.setIndex(i, col, zero);
        }
    }

    // Sets a row to all zeros.
    public zeroRow(row: number) {
        for (let i = 0; i < this.cols; i++) {
            this.setIndex(row, i, zero);
        }
    }

    public swapRows(a: number, b: number) {
        for (let i = 0; i < this.cols; i++) {
            const temp = this.index(a, i);
            this.setIndex(a, i, this.index(b, i));
            this.setIndex(b, i, temp);
        }
    }

    // Places the matrix into reduced row echelon form, in-place, and returns
    // the column numbers of the pivots.
    public rref() {
        const rows = this.rows;
        const cols = this.cols;
        let pivRow = 0;
        let pivCol = 0;
        const pivots = [];
        while (pivCol < cols && pivRow < rows) {
            let pivotVal;
            let pivotOffset = 0;
            for (; pivotOffset < rows - pivRow; pivotOffset++) {
                pivotVal = this.index(pivRow + pivotOffset, pivCol);
                if (!pivotVal.isZero()) {
                    break;
                }
            }
            if (pivotOffset === rows - pivRow) {
                pivCol++;
                continue;
            }
            pivots.push(pivCol);
            if (pivotOffset !== 0) {
                this.swapRows(pivRow, pivRow + pivotOffset);
            }
            for (let row = 0; row < rows; row++) {
                if (row === pivRow) {
                    continue;
                }
                const val = this.index(row, pivCol);
                if (val.isZero()) {
                    continue;
                }
                for (let i = 0; i < cols; i++) {
                    const newVal = pivotVal.mul(this.index(row, i)).sub(val.mul(this.index(pivRow, i)));
                    this.setIndex(row, i, newVal);
                }
            }
            pivRow += 1;
        }
        for (let i = 0; i < pivots.length; i++) {
            const j = pivots[i];
            const pivotVal = this.index(i, j);
            this.setIndex(i, j, one);
            for (let col = j + 1; col < cols; col++) {
                this.setIndex(i, col, this.index(i, col).div(pivotVal));
            }
        }
        return pivots;
    }
}
