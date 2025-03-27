'use strict';
export class jFSMRouter {
    static Create(initialState) {
        return new jFSMRouter(initialState);
    }
    _regexDuplicatePathId = new RegExp(/\/(:\w+)\[(?:09|AZ)]\/(?:.+\/)?(\1)(?:\[(?:09|AZ)]|\/|$)/g);
    _regexSearchVariables = new RegExp(/(?<=^|\/):(\w+)(?:\[(09|AZ)])?(?=\/|$)/g);
    _routes = [];
    _routeFunction403 = undefined;
    _routeFunction404 = undefined;
    _routing = false;
    _queue = [];
    _inTransition = false;
    _currentState;
    _states = {};
    _transitions = {};
    constructor(initialState) {
        window.addEventListener("hashchange", this.CheckHash.bind(this));
        this.StateAdd(initialState);
        this._currentState = initialState;
    }
    StateAdd(state) {
        let returnValue = false;
        if ('undefined' === typeof (this._states[state])) {
            this._states[state] = {
                OnEnter: [],
                OnLeave: []
            };
            this._transitions[state] = {};
            returnValue = true;
        }
        return returnValue;
    }
    StateDel(state) {
        let returnValue = false;
        if ('undefined' !== typeof (this._states[state])) {
            delete (this._states[state]);
            if ('undefined' !== typeof (this._transitions[state])) {
                delete (this._transitions[state]);
            }
            for (const tmpState in this._transitions) {
                if ('undefined' !== typeof (this._transitions[tmpState][state])) {
                    delete (this._transitions[tmpState][state]);
                }
            }
            returnValue = true;
        }
        return returnValue;
    }
    StateOnEnterAdd(state, func) {
        let returnValue = false;
        if ('undefined' !== typeof (this._states[state])) {
            if (!this._states[state].OnEnter.includes(func)) {
                this._states[state].OnEnter.push(func);
                returnValue = true;
            }
        }
        return returnValue;
    }
    StateOnEnterDel(state, func) {
        let returnValue = false;
        if ('undefined' !== typeof (this._states[state])) {
            const pos = this._states[state].OnEnter.indexOf(func);
            if (-1 !== pos) {
                this._states[state].OnEnter.splice(pos, 1);
                returnValue = true;
            }
        }
        return returnValue;
    }
    StateOnLeaveAdd(state, func) {
        let returnValue = false;
        if ('undefined' !== typeof (this._states[state])) {
            if (!this._states[state].OnLeave.includes(func)) {
                this._states[state].OnLeave.push(func);
                returnValue = true;
            }
        }
        return returnValue;
    }
    StateOnLeaveDel(state, func) {
        let returnValue = false;
        if ('undefined' !== typeof (this._states[state])) {
            const pos = this._states[state].OnLeave.indexOf(func);
            if (-1 !== pos) {
                this._states[state].OnLeave.splice(pos, 1);
                returnValue = true;
            }
        }
        return returnValue;
    }
    TransitionAdd(from, to) {
        let returnValue = false;
        if (('undefined' !== typeof (this._states[from])) && ('undefined' !== typeof (this._states[to]))) {
            if ('undefined' === typeof (this._transitions[from][to])) {
                this._transitions[from][to] = {
                    OnBefore: [],
                    OnAfter: []
                };
                returnValue = true;
            }
        }
        return returnValue;
    }
    TransitionDel(from, to) {
        let returnValue = false;
        if (('undefined' !== typeof (this._states[from])) && ('undefined' !== typeof (this._states[to]))) {
            if ('undefined' !== typeof (this._transitions[from][to])) {
                delete (this._transitions[from][to]);
                returnValue = true;
            }
        }
        return returnValue;
    }
    TransitionOnBeforeAdd(from, to, func) {
        let returnValue = false;
        if (('undefined' !== typeof (this._states[from])) && ('undefined' !== typeof (this._states[to]))) {
            if ('undefined' !== typeof (this._transitions[from][to])) {
                this._transitions[from][to].OnBefore.push(func);
                returnValue = true;
            }
        }
        return returnValue;
    }
    TransitionOnBeforeDel(from, to, func) {
        let returnValue = false;
        if (('undefined' !== typeof (this._states[from])) && ('undefined' !== typeof (this._states[to]))) {
            if ('undefined' !== typeof (this._transitions[from][to])) {
                const pos = this._transitions[from][to].OnBefore.indexOf(func);
                if (-1 !== pos) {
                    this._transitions[from][to].OnBefore.splice(pos, 1);
                    returnValue = true;
                }
            }
        }
        return returnValue;
    }
    TransitionOnAfterAdd(from, to, func) {
        let returnValue = false;
        if (('undefined' !== typeof (this._states[from])) && ('undefined' !== typeof (this._states[to]))) {
            if ('undefined' !== typeof (this._transitions[from][to])) {
                this._transitions[from][to].OnAfter.push(func);
                returnValue = true;
            }
        }
        return returnValue;
    }
    TransitionOnAfterDel(from, to, func) {
        let returnValue = false;
        if (('undefined' !== typeof (this._states[from])) && ('undefined' !== typeof (this._states[to]))) {
            if ('undefined' !== typeof (this._transitions[from][to])) {
                const pos = this._transitions[from][to].OnAfter.indexOf(func);
                if (-1 !== pos) {
                    this._transitions[from][to].OnAfter.splice(pos, 1);
                    returnValue = true;
                }
            }
        }
        return returnValue;
    }
    StateGet() {
        return this._currentState;
    }
    async StateSet(nextState) {
        let returnValue = false;
        if (!this._inTransition) {
            if ('undefined' !== typeof (this._states[nextState])) {
                if (('undefined' !== typeof (this._transitions[this._currentState])) && ('undefined' !== typeof (this._transitions[this._currentState][nextState]))) {
                    returnValue = true;
                    let cFL;
                    cFL = this._transitions[this._currentState][nextState].OnBefore.length;
                    for (let iFL = 0; (returnValue && (iFL < cFL)); iFL++) {
                        if ('function' === typeof (this._transitions[this._currentState][nextState].OnBefore[iFL])) {
                            let tmpValue = null;
                            if ('AsyncFunction' === this._transitions[this._currentState][nextState].OnBefore[iFL].constructor.name) {
                                tmpValue = await this._transitions[this._currentState][nextState].OnBefore[iFL]();
                            }
                            else {
                                tmpValue = this._transitions[this._currentState][nextState].OnBefore[iFL]();
                            }
                            returnValue = (false !== tmpValue);
                        }
                    }
                    if (returnValue) {
                        cFL = this._states[this._currentState].OnLeave.length;
                        for (let iFL = 0; iFL < cFL; iFL++) {
                            if ('function' === typeof (this._states[this._currentState].OnLeave[iFL])) {
                                if ('AsyncFunction' === this._states[this._currentState].OnLeave[iFL].constructor.name) {
                                    await this._states[this._currentState].OnLeave[iFL](this._currentState, nextState);
                                }
                                else {
                                    this._states[this._currentState].OnLeave[iFL](this._currentState, nextState);
                                }
                            }
                        }
                        let previousState = this._currentState;
                        this._currentState = nextState;
                        cFL = this._transitions[previousState][this._currentState].OnAfter.length;
                        for (let iFL = 0; iFL < cFL; iFL++) {
                            if ('function' === typeof (this._transitions[previousState][this._currentState].OnAfter[iFL])) {
                                if ('AsyncFunction' === this._transitions[previousState][this._currentState].OnAfter[iFL].constructor.name) {
                                    await this._transitions[previousState][this._currentState].OnAfter[iFL]();
                                }
                                else {
                                    this._transitions[previousState][this._currentState].OnAfter[iFL]();
                                }
                            }
                        }
                        cFL = this._states[this._currentState].OnEnter.length;
                        for (let iFL = 0; iFL < cFL; iFL++) {
                            if ('function' === typeof (this._states[this._currentState].OnEnter[iFL])) {
                                if ('AsyncFunction' === this._states[this._currentState].OnEnter[iFL].constructor.name) {
                                    await this._states[this._currentState].OnEnter[iFL](this._currentState, previousState);
                                }
                                else {
                                    this._states[this._currentState].OnEnter[iFL](this._currentState, previousState);
                                }
                            }
                        }
                    }
                }
            }
            this._inTransition = false;
        }
        return returnValue;
    }
    CheckTransition(nextState) {
        let returnValue = false;
        if (!this._inTransition) {
            if ('undefined' !== typeof (this._states[nextState])) {
                if (('undefined' !== typeof (this._transitions[this._currentState])) && ('undefined' !== typeof (this._transitions[this._currentState][nextState]))) {
                    returnValue = true;
                }
            }
        }
        return returnValue;
    }
    RouteSpecialAdd(code, routeFunction) {
        let returnValue = false;
        switch (code) {
            case 403: {
                this._routeFunction403 = routeFunction;
                returnValue = true;
                break;
            }
            case 404: {
                this._routeFunction404 = routeFunction;
                returnValue = true;
                break;
            }
            default: {
                throw new RangeError();
            }
        }
        return returnValue;
    }
    RouteAdd(validState, path, routeFunction, available, routeFunction403) {
        let returnValue = false;
        if ('undefined' === typeof (this._states[validState])) {
            throw new SyntaxError('Non-existent state');
        }
        else {
            if (path.match(this._regexDuplicatePathId)) {
                throw new SyntaxError('Duplicate path id');
            }
            else {
                let weight = 0;
                const paths = path.split('/');
                const cFL = paths.length;
                for (let iFL = 0; iFL < cFL; iFL++) {
                    if (!paths[iFL].startsWith(':')) {
                        weight += 2 ** (cFL - iFL - 1);
                    }
                }
                let regex = new RegExp('^' + path.replace(this._regexSearchVariables, function (_unused, name, type) {
                    let returnValue = '(?<' + name + '>[';
                    switch (type) {
                        case '09': {
                            returnValue += '\\d';
                            break;
                        }
                        case 'AZ': {
                            returnValue += 'a-zA-Z';
                            break;
                        }
                        default: {
                            returnValue += '\\w';
                        }
                    }
                    returnValue += ']+)';
                    return returnValue;
                }).replace(/\//g, '\\\/') + '$');
                const reducedPath = path.replace(this._regexSearchVariables, ':$2');
                if (!this._routes.find((route) => (reducedPath === route.path))) {
                    this._routes.push({
                        path: reducedPath,
                        validState: validState,
                        match: regex,
                        weight: weight,
                        routeFunction: routeFunction,
                        available: available,
                        routeFunction403: routeFunction403
                    });
                    this._routes.sort((a, b) => ((a.weight > b.weight) ? -1 : ((b.weight > a.weight) ? 1 : 0)));
                    returnValue = true;
                }
            }
        }
        return returnValue;
    }
    RouteDel(path) {
        let returnValue = false;
        if (path.match(this._regexDuplicatePathId)) {
            throw new SyntaxError('Duplicate path id');
        }
        else {
            const reducedPath = path.replace(this._regexSearchVariables, ':$2');
            const index = this._routes.findIndex((route) => (reducedPath == route.path));
            if (-1 < index) {
                this._routes.splice(index, 1);
                returnValue = true;
            }
        }
        return returnValue;
    }
    Trigger(path) {
        if ('#' + path != window.location.hash) {
            window.location.hash = '#' + path;
        }
    }
    async Route(path) {
        this._routing = true;
        let routeFunction = undefined;
        let routePath = '';
        let result = null;
        for (const route of this._routes) {
            if ((result = route.match.exec(path))) {
                routePath = route.path;
                let available = true;
                if (route.available) {
                    available = false;
                    if ('function' === typeof route.available) {
                        if ('AsyncFunction' === route.available.constructor.name) {
                            available = await route.available(routePath, path, (result.groups ?? {}));
                        }
                        else {
                            available = route.available(routePath, path, (result.groups ?? {}));
                        }
                    }
                }
                if (available &&
                    (('undefined' === typeof route.validState) ||
                        (this._currentState === route.validState) ||
                        (this.CheckTransition(route.validState)))) {
                    if (route.validState && (this._currentState !== route.validState)) {
                        await this.StateSet(route.validState);
                    }
                    routeFunction = route.routeFunction;
                }
                else if (route.routeFunction403) {
                    routeFunction = route.routeFunction403;
                }
                else if (this._routeFunction403) {
                    routeFunction = this._routeFunction403;
                }
                break;
            }
        }
        if (!routeFunction || ('function' !== typeof routeFunction)) {
            if (this._routeFunction404) {
                routeFunction = this._routeFunction404;
            }
        }
        if (routeFunction && ('function' === typeof routeFunction)) {
            if ('AsyncFunction' === routeFunction.constructor.name) {
                await routeFunction(routePath, path, (result?.groups ?? {}));
            }
            else {
                routeFunction(routePath, path, (result?.groups ?? {}));
            }
        }
        if (this._queue.length) {
            await this.Route(this._queue.shift());
        }
        else {
            this._routing = false;
        }
    }
    async CheckHash() {
        const hash = (window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '');
        if ('' != hash) {
            if (this._routing) {
                this._queue.push(hash);
            }
            else {
                await this.Route(hash);
            }
        }
    }
}
