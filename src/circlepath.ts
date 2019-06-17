class CirclePath {
    public points: Array<{
        x: number,
        y: number,
        nx: number,
        ny: number,
        r: number,
        sweep: number,
    }>;
    constructor(nx: number, ny: number, pairs: Array<{ x: number, y: number }>) {
        const { x, y } = pairs[0];
        let r: number = null;
        let sweep: number = null;
        // (x, y): The coordinate.
        // (nx, ny): The unit vector tangent to the curve at this point.
        // r: The radius of the circle leading to this point.
        // sweep: 1 = clockwise, 0 = counter-clockwise
        // r and sweep are null for the first point, as there is no circle
        // leading to it.
        const points = [{ x, y, nx, ny, r, sweep }];
        let prevX = x;
        let prevY = y;
        for (const { x: curX, y: curY } of pairs.slice(1)) {
            const dx = (curX - prevX) / 2;
            const dy = (curY - prevY) / 2;
            const t = nx * dx + ny * dy;
            let r1 = -ny * dx + nx * dy;
            // If deflection is less than one pixel, draw a straight line.
            if (-0.5 < r1 && r1 < 0.5) {
                r = null;
                sweep = null;
                // Still update n vector.
                const [normdx, normdy] = norm([dx, dy]);
                const dot = nx * normdx + ny * normdy;
                nx = 2 * dot * normdx - nx;
                ny = 2 * dot * normdy - ny;
                points.push({ x: curX, y: curY, nx, ny, r, sweep });
                prevX = curX;
                prevY = curY;
                continue;
            }
            sweep = 1;
            let npx = -ny;
            let npy = nx;
            if (r1 < 0) {
                sweep = 0;
                r1 = -r1;
                npx = -npx;
                npy = -npy;
            }
            r = r1 + t ** 2 / r1;
            const cx = npx * r;
            const cy = npy * r;
            // compute new tangent
            npx = (cx - 2 * dx) / r;
            npy = (cy - 2 * dy) / r;
            nx = npy;
            ny = -npx;
            if (sweep === 0) {
                nx = -nx;
                ny = -ny;
            }
            points.push({ x: curX, y: curY, nx, ny, r, sweep });
            prevX = curX;
            prevY = curY;
        }
        this.points = points;
    }

    public path() {
        const { x, y } = this.points[0];
        const parts = [`M ${x},${y}`];
        for (const { x: curX, y: curY, r, sweep } of this.points.slice(1)) {
            if (r === null || Number.isNaN(r)) {
                parts.push(`L ${curX},${curY}`);
                continue;
            }
            parts.push(`A ${r} ${r} 0 0 ${sweep} ${curX} ${curY}`);
        }
        return parts.join(" ");
    }

    public offset(offset: number) {
        const tx = this.points[0].nx;
        const ty = this.points[0].ny;
        const points = [];
        for (const { x, y, nx, ny } of this.points) {
            points.push({ x: x + -ny * offset, y: y + nx * offset });
        }
        return new CirclePath(tx, ty, points);
    }

    public transpose() {
        const points = [];
        for (let { x, y, nx, ny, r, sweep } of this.points) {
            if (sweep === 0) {
                sweep = 1;
            } else if (sweep === 1) {
                sweep = 0;
            }
            points.push({
                nx: ny,
                ny: nx,
                r,
                sweep,
                x: y,
                y: x,
            });
        }
        const obj = Object.create(CirclePath.prototype);
        obj.points = points;
        return obj;
    }
}

function norm([x, y]: number[]) {
    const d = Math.sqrt(x ** 2 + y ** 2);
    return [x / d, y / d];
}

const MIN_RADIUS = 10;

// Paths come in four kinds. All mentioned slopes are within the frame of
// reference of the initial tangent vector.
// (E.g. when t is <1, 0>, slopes have the usual meaning.)
// 1) Straight line
//      Used when slope == 0.
// 2) Double arcs
//      Used when slope of overall line is in the range [-0.75, 0.75],
//      excluding 0.
//
//      Consists of two circular arcs, one beginning at the start point and
//      terminating at the middle, the other beginning at the middle and
//      terminating at the end point.
// 3) Initial adjustment w/ double arcs
//      Used with steeper slopes than the previous, so long as the first
//      critical point is located before the line crossing through the center
//      with double the slope.
//
//      Similar to the double arcs, but with a short initial curve on either
//      end to permit the slope at the middle point to equal double the
//      overall slope (similar to a cubic Bezier curve).
// 4) Initial adjustment w/ straight line
//      Used as final fallback in all other cases.
//
//      Generally only needed when the overall slope is too steep for other
//      approaches to be feasible.

// Vector from start point to end point in reference frame of tangent vector.
function toFrame(tx: number, ty: number, x: number, y: number) {
    const dotx = tx * x + ty * y;
    const doty = -ty * x + tx * y;
    return [dotx, doty];
}

function fromFrame(tx: number, ty: number, x: number, y: number) {
    return toFrame(tx, -ty, x, y);
}

function frameSlope(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number): number | null {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const [fx, fy] = toFrame(tx, ty, dx, dy);
    if (fx === 0) {
        return null;
    }
    return fy / fx;
}

function linePath(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number) {
    return new CirclePath(tx, ty, [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
    ]);
}

function doubleArcPath(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number) {
    const midx = (x1 + x2) / 2;
    const midy = (y1 + y2) / 2;
    return new CirclePath(tx, ty, [
        { x: x1, y: y1 },
        { x: midx, y: midy },
        { x: x2, y: y2 },
    ]);
}

// Vector transpose functions in SVG coord space (i.e. inverted y axis).
function R(x: number, y: number) {
    return [-y, x];
}
function L(x: number, y: number) {
    return [y, -x];
}

function doubleArcAdjustPath(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number, width: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const [fx, fy] = toFrame(tx, ty, dx, dy);
    let T;
    if (fy > 0) {
        // Curving to right.
        T = R;
    } else {
        // Curving to left.
        T = L;
    }
    const [nx, ny] = T(tx, ty);
    // radius of first circle
    const r = width / 2 + MIN_RADIUS;
    // center point of first circle
    const cx = x1 + nx * r;
    const cy = y1 + ny * r;
    // center point of whole curve
    const p3x = (x1 + x2) / 2;
    const p3y = (y1 + y2) / 2;
    // desired tangent vector at center point
    const [ctx, cty] = fromFrame(tx, ty, fx / 2, fy);
    // unit vector normal to tangent at center point
    // (points at center of second circle)
    const [cnx, cny] = norm(T(ctx, cty));
    // proceed from p3, r units towards center of circle 2
    const midx = p3x + cnx * r;
    const midy = p3y + cny * r;
    // vector pointing from center of circle 1, to that point
    const crossx = midx - cx;
    const crossy = midy - cy;
    // unit vector pointing from midpoint of that cross-vector, to center of
    // circle 2
    const [mx, my] = norm(T(crossx, crossy));
    // reflect cn over m; gives unit vector pointing from center of circle 1
    // to center of circle 2
    const dot = cnx * mx + cny * my;
    const ox = 2 * dot * mx - cnx;
    const oy = 2 * dot * my - cny;
    // calculate points 2 and 4
    const p2x = cx + -ox * r;
    const p2y = cy + -oy * r;
    const p4x = x2 - (p2x - x1);
    const p4y = y2 - (p2y - y1);
    return new CirclePath(tx, ty, [
        { x: x1, y: y1 },
        { x: p2x, y: p2y },
        { x: p3x, y: p3y },
        { x: p4x, y: p4y },
        { x: x2, y: y2 },
    ]);
}

function lineAdjustPath(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number, width: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const [fx, fy] = toFrame(tx, ty, dx, dy);
    let T;
    if (fy > 0) {
        // Curving to right.
        T = R;
    } else {
        // Curving to left.
        T = L;
    }
    const [nx, ny] = T(tx, ty);
    // radius of both circles
    const r = width / 2 + MIN_RADIUS;
    // center points of both circles
    const r1x = x1 + nx * r;
    const r1y = y1 + ny * r;
    const r2x = x2 - nx * r;
    const r2y = y2 - ny * r;
    // center point of whole curve
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    // distance between circle center and curve center
    const d = Math.sqrt((cx - r1x) ** 2 + (cy - r1y) ** 2);
    // unit vector from circle center to curve center
    const ax = (cx - r1x) / d;
    const ay = (cy - r1y) / d;
    // normal pointing towards inflection point
    const [bx, by] = T(-ax, -ay);
    // A wee spot o' trig.
    const d1 = r ** 2 / d;
    const h = r ** 2 - Math.sqrt(r ** 2 - r ** 4 / d ** 2);
    const px = ax * d1 + bx * h;
    const py = ay * d1 + by * h;

    return new CirclePath(undefined, undefined, [
        { x: x1, y: y1 },
        { x: r1x + px, y: r1y + py },
        { x: r2x - px, y: r2y - py },
        { x: x2, y: y2 },
    ]);
}

function makeCurve(tx: number, ty: number, x1: number, y1: number, x2: number, y2: number, width?: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const [fx, fy] = toFrame(tx, ty, dx, dy);
    if (fy === 0) {
        return linePath(tx, ty, x1, y1, x2, y2);
    }
    const slope = fy / fx;
    if (-0.75 <= slope && slope <= 0.75) {
        return doubleArcPath(tx, ty, x1, y1, x2, y2);
    }
    return doubleArcAdjustPath(tx, ty, x1, y1, x2, y2, width);
}

export {
    CirclePath,
    makeCurve,
};
