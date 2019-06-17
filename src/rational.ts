import bigInt = require("big-integer");

class Rational {
    private p: bigInt.BigInteger;
    private q: bigInt.BigInteger;

    constructor(p: bigInt.BigInteger, q: bigInt.BigInteger) {
        if (q.lesser(bigInt.zero)) {
            p = bigInt.zero.minus(p);
            q = bigInt.zero.minus(q);
        }
        const gcd = bigInt.gcd(p.abs(), q);
        if (gcd.greater(bigInt.one)) {
            p = p.divide(gcd);
            q = q.divide(gcd);
        }
        this.p = p;
        this.q = q;
    }
    public toFloat() {
        return this.p.toJSNumber() / this.q.toJSNumber();
    }

    public toString() {
        if (this.q.equals(bigInt.one)) {
            return this.p.toString();
        }
        return this.p.toString() + "/" + this.q.toString();
    }

    public toDecimal(maxDigits?: number, roundingFactor?: Rational) {
        if (maxDigits == null) {
            maxDigits = 3;
        }
        if (roundingFactor == null) {
            roundingFactor = new Rational(bigInt(5), bigInt(10).pow(maxDigits + 1));
        }

        let sign = "";
        let x: Rational = this;
        if (x.less(zero)) {
            sign = "-";
            x = zero.sub(x);
        }
        x = x.add(roundingFactor);
        let divmod = x.p.divmod(x.q);
        const integerPart = divmod.quotient.toString();
        let decimalPart = "";
        let fraction = new Rational(divmod.remainder, x.q);
        const ten = new Rational(bigInt(10), bigInt.one);
        while (maxDigits > 0 && !fraction.equal(roundingFactor)) {
            fraction = fraction.mul(ten);
            roundingFactor = roundingFactor.mul(ten);
            divmod = fraction.p.divmod(fraction.q);
            decimalPart += divmod.quotient.toString();
            fraction = new Rational(divmod.remainder, fraction.q);
            maxDigits--;
        }
        if (fraction.equal(roundingFactor)) {
            while (decimalPart[decimalPart.length - 1] === "0") {
                decimalPart = decimalPart.slice(0, decimalPart.length - 1);
            }
        }
        if (decimalPart !== "") {
            return sign + integerPart + "." + decimalPart;
        }
        return sign + integerPart;
    }

    public toUpDecimal(maxDigits: number) {
        const fraction = new Rational(bigInt.one, bigInt(10).pow(maxDigits));
        const divmod = this.divmod(fraction);
        let x: Rational = this;
        if (!divmod.remainder.isZero()) {
            x = x.add(fraction);
        }
        return x.toDecimal(maxDigits, zero);
    }

    public toMixed() {
        const divmod = this.p.divmod(this.q);
        if (divmod.quotient.isZero() || divmod.remainder.isZero()) {
            return this.toString();
        }
        return divmod.quotient.toString() + " + " + divmod.remainder.toString() + "/" + this.q.toString();
    }

    public isZero() {
        return this.p.isZero();
    }

    public isInteger() {
        return this.q.equals(bigInt.one);
    }

    public ceil() {
        const divmod = this.p.divmod(this.q);
        let result = new Rational(divmod.quotient, bigInt.one);
        if (!divmod.remainder.isZero()) {
            result = result.add(one);
        }
        return result;
    }

    public floor() {
        const divmod = this.p.divmod(this.q);
        let result = new Rational(divmod.quotient, bigInt.one);
        if (result.less(zero) && !divmod.remainder.isZero()) {
            result = result.sub(one);
        }
        return result;
    }

    public equal(other: Rational) {
        return this.p.equals(other.p) && this.q.equals(other.q);
    }

    public less(other: Rational) {
        return this.p.times(other.q).lesser(this.q.times(other.p));
    }

    public abs() {
        if (this.less(zero)) {
            return this.mul(minusOne);
        }
        return this;
    }

    public add(other: Rational) {
        return new Rational(
            this.p.times(other.q).plus(this.q.times(other.p)),
            this.q.times(other.q),
        );
    }

    public sub(other: Rational) {
        return new Rational(
            this.p.times(other.q).subtract(this.q.times(other.p)),
            this.q.times(other.q),
        );
    }

    public mul(other: Rational) {
        return new Rational(
            this.p.times(other.p),
            this.q.times(other.q),
        );
    }

    public div(other: Rational) {
        return new Rational(
            this.p.times(other.q),
            this.q.times(other.p),
        );
    }

    public divmod(other: Rational) {
        const quotient = this.div(other);
        const div = quotient.floor();
        const mod = this.sub(other.mul(div));
        return { quotient: div, remainder: mod };
    }

    public reciprocate() {
        return new Rational(this.q, this.p);
    }
}

function RationalFromString(s: string) {
    const i = s.indexOf("/");
    if (i === -1) {
        return RationalFromFloat(Number(s));
    }
    const j = s.indexOf("+");
    const q = bigInt(s.slice(i + 1));
    let p: bigInt.BigInteger;
    if (j !== -1) {
        const integer = bigInt(s.slice(0, j));
        p = bigInt(s.slice(j + 1, i)).plus(integer.times(q));
    } else {
        p = bigInt(s.slice(0, i));
    }
    return new Rational(p, q);
}

function RationalFromFloat(x: number) {
    if (Number.isInteger(x)) {
        return RationalFromFloats(x, 1);
    }
    // Sufficient precision for our data?
    const r = new Rational(bigInt(Math.round(x * 100000)), bigInt(100000));
    // Recognize 1/3 and 2/3 explicitly.
    const divmod = r.divmod(one);
    if (divmod.remainder.equal(new Rational(bigInt(33333), bigInt(100000)))) {
        return divmod.quotient.add(oneThird);
    } else if (divmod.remainder.equal(new Rational(bigInt(33333), bigInt(50000)))) {
        return divmod.quotient.add(twoThirds);
    }
    return r;
}

function RationalFromFloats(p: number, q: number) {
    return new Rational(bigInt(p), bigInt(q));
}

const minusOne = new Rational(bigInt.minusOne, bigInt.one);
const zero = new Rational(bigInt.zero, bigInt.one);
const one = new Rational(bigInt.one, bigInt.one);
const half = new Rational(bigInt.one, bigInt(2));
const oneThird = new Rational(bigInt.one, bigInt(3));
const twoThirds = new Rational(bigInt(2), bigInt(3));

export {
    Rational,
    RationalFromString,
    RationalFromFloat,
    RationalFromFloats,
    minusOne,
    zero,
    one,
    half,
    oneThird,
    twoThirds,
};
