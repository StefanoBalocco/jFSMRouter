export type FunctionOnEnter = (currentState: string, nextState: string) => (void | Promise<void>);
export type FunctionOnLeave = (currentState: string, prevState: string) => (void | Promise<void>);
export type FunctionOnTransitionAfter = () => (void | Promise<void>);
export type FunctionOnTransitionBefore = () => (any | Promise<any>);
export type CheckAvailability = (path: string, hashPath: string, params?: {
    [key: string]: string;
}) => (boolean | Promise<boolean>);
export type RouteFunction = (path: string, hashPath: string, params?: {
    [key: string]: string;
}) => (void | Promise<void>);
export declare class jFSMRouter {
    static Create(initialState: string): jFSMRouter;
    private _regexDuplicatePathId;
    private _regexSearchVariables;
    private _routes;
    private _routeFunction403;
    private _routeFunction404;
    private _routing;
    private _queue;
    private _inTransition;
    private _currentState;
    private _states;
    private _transitions;
    private constructor();
    StateAdd(state: string): boolean;
    StateDel(state: string): boolean;
    StateOnEnterAdd(state: string, func: FunctionOnEnter): boolean;
    StateOnEnterDel(state: string, func: FunctionOnEnter): boolean;
    StateOnLeaveAdd(state: string, func: FunctionOnLeave): boolean;
    StateOnLeaveDel(state: string, func: FunctionOnLeave): boolean;
    TransitionAdd(from: string, to: string): boolean;
    TransitionDel(from: string, to: string): boolean;
    TransitionOnBeforeAdd(from: string, to: string, func: FunctionOnTransitionBefore): boolean;
    TransitionOnBeforeDel(from: string, to: string, func: FunctionOnTransitionBefore): boolean;
    TransitionOnAfterAdd(from: string, to: string, func: FunctionOnTransitionAfter): boolean;
    TransitionOnAfterDel(from: string, to: string, func: FunctionOnTransitionAfter): boolean;
    StateGet(): string;
    StateSet(nextState: string): Promise<boolean>;
    CheckTransition(nextState: string): boolean;
    RouteSpecialAdd(code: number, routeFunction: RouteFunction): boolean;
    RouteAdd(validState: string, path: string, routeFunction: RouteFunction, available?: CheckAvailability, routeFunction403?: RouteFunction): boolean;
    RouteDel(path: string): boolean;
    Trigger(path: string): void;
    Route(path: string): Promise<void>;
    CheckHash(): Promise<void>;
}
