// MIT license: https://d20.zip/license.txt
// https://github.com/DenWav/d20.zip

export interface MathResult {
    value: number;
    breakdown: string;
    expanded?: MathResult[];
}

export function evaluateMath(expr: string, placeholders?: Record<string, MathResult>): MathResult {
    const tokens = expr.match(/\d+\.?\d*|[a-z]+|__G\d+__|[+\-*/(),]/gi) || [];
    const values: MathResult[] = [];
    const ops: string[] = [];
    const argCountStack: number[] = [];

    const precedence: { [key: string]: number } = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2,
    };

    const applyOp = () => {
        if (ops.length === 0) return;
        const op = ops.pop()!;
        if (op.endsWith('(')) return;
        if (values.length < 2) throw new Error('Invalid expression');
        const b = values.pop()!;
        const a = values.pop()!;
        let res: number;
        switch (op) {
            case '+':
                res = a.value + b.value;
                break;
            case '-':
                res = a.value - b.value;
                break;
            case '*':
                res = a.value * b.value;
                break;
            case '/':
                res = a.value / b.value;
                break;
            default:
                throw new Error('Unknown operator: ' + op);
        }
        values.push({
            value: res,
            breakdown: `${a.breakdown} ${op} ${b.breakdown}`,
        });
    };

    const applyFunc = (func: string, n: number) => {
        if (values.length < n) throw new Error('Insufficient operands for function');
        const args: MathResult[] = [];
        for (let i = 0; i < n; i++) args.unshift(values.pop()!);

        const f = func.toLowerCase();
        let val: number;
        let bd: string;

        if (f === 'max' || f === 'min') {
            const vList = args.map((a) => a.value);
            val = f === 'max' ? Math.max(...vList) : Math.min(...vList);
            let found = false;
            const bds = args.map((a) => {
                if (!found && a.value === val) {
                    found = true;
                    return a.breakdown;
                }
                return `<del>${a.breakdown}</del>`;
            });
            bd = `${f}(${bds.join(', ')})`;
        } else if (f === 'avg') {
            const vList = args.map((a) => a.value);
            val = vList.length === 0 ? 0 : vList.reduce((s, x) => s + x, 0) / vList.length;
            bd = `avg(${args.map((a) => a.breakdown).join(', ')})`;
        } else {
            throw new Error('Unknown function: ' + func);
        }
        values.push({ value: val, breakdown: bd });
    };

    let nextIsExpanded = false;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];

        if (t === '*') {
            const prev = i > 0 ? tokens[i - 1] : null;
            const isUnary = !prev || /^[+\-*/(,]$/.test(prev);
            if (isUnary) {
                nextIsExpanded = true;
                continue;
            }
        }

        if (t.startsWith('__G')) {
            const res = placeholders?.[t] || { value: 0, breakdown: '0' };
            if (nextIsExpanded) {
                const items = res.expanded || [res];
                for (const item of items) values.push(item);
                if (argCountStack.length > 0 && argCountStack[argCountStack.length - 1] > 0) {
                    argCountStack[argCountStack.length - 1] += items.length - 1;
                }
                nextIsExpanded = false;
            } else {
                values.push(res);
            }
        } else if (!isNaN(parseFloat(t))) {
            const res = { value: parseFloat(t), breakdown: t };
            if (nextIsExpanded) {
                values.push(res);
                nextIsExpanded = false;
            } else {
                values.push(res);
            }
        } else if (/[a-z]+/i.test(t)) {
            ops.push(t);
        } else if (t === '(') {
            ops.push(nextIsExpanded ? '*(' : '(');
            nextIsExpanded = false;
            argCountStack.push(i > 0 && /[a-z]+/i.test(tokens[i - 1]) ? 1 : 0);
        } else if (t === ',') {
            while (ops.length && !ops[ops.length - 1].endsWith('(')) applyOp();
            if (argCountStack.length === 0 || argCountStack[argCountStack.length - 1] === 0) {
                throw new Error('Unexpected comma');
            }
            argCountStack[argCountStack.length - 1]++;
        } else if (t === ')') {
            while (ops.length && !ops[ops.length - 1].endsWith('(')) applyOp();
            if (ops.length === 0) throw new Error('Mismatched parentheses');
            const openOp = ops.pop()!;
            const shouldExpand = openOp === '*(';

            const n = argCountStack.pop()!;
            if (ops.length > 0 && /[a-z]+/i.test(ops[ops.length - 1])) {
                applyFunc(ops.pop()!, n);
                if (shouldExpand) {
                    const res = values.pop()!;
                    const items = res.expanded || [res];
                    for (const item of items) values.push(item);
                    if (argCountStack.length > 0 && argCountStack[argCountStack.length - 1] > 0) {
                        argCountStack[argCountStack.length - 1] += items.length - 1;
                    }
                }
            } else {
                const inner = values.pop()!;
                if (shouldExpand) {
                    const items = inner.expanded || [inner];
                    for (const item of items) values.push(item);
                    if (argCountStack.length > 0 && argCountStack[argCountStack.length - 1] > 0) {
                        argCountStack[argCountStack.length - 1] += items.length - 1;
                    }
                } else {
                    values.push({ value: inner.value, breakdown: `(${inner.breakdown})`, expanded: inner.expanded });
                }
            }
        } else {
            while (
                ops.length &&
                !ops[ops.length - 1].endsWith('(') &&
                precedence[ops[ops.length - 1]] >= (precedence[t] || 0)
            ) {
                applyOp();
            }
            ops.push(t);
        }
    }

    while (ops.length) {
        if (ops[ops.length - 1].endsWith('(')) throw new Error('Mismatched parentheses');
        applyOp();
    }

    if (values.length > 1) throw new Error('Too many values');
    const result = values[0] || { value: 0, breakdown: '0' };
    return {
        value: Math.round(result.value * 10) / 10,
        breakdown: result.breakdown,
    };
}
