type Undefinedable<T> = T | undefined;
type Nullable<T> = T | null;

export type FunctionOnEnter = ( currentState: string, nextState: string ) => ( void | Promise<void> );
export type FunctionOnLeave = ( currentState: string, prevState: string ) => ( void | Promise<void> );
export type FunctionOnTransitionAfter = () => ( void | Promise<void> );
export type FunctionOnTransitionBefore = () => ( any | Promise<any> );
export type CheckAvailability = ( path: string, hashPath: string, params?: { [ key: string ]: string } ) => ( boolean | Promise<boolean> );
export type RouteFunction = ( path: string, hashPath: string, params?: { [ key: string ]: string } ) => ( void | Promise<void> );
type Route = {
	path: string,
	validState: string,
	match: RegExp,
	weight: number,
	routeFunction: RouteFunction,
	available?: CheckAvailability,
	routeFunction403?: RouteFunction
};

class jFSMRouter {
	private static _instance: Undefinedable<jFSMRouter>;

	public static get instance(): jFSMRouter {
		return ( jFSMRouter._instance ??= new jFSMRouter( window ) );
	}

	private _regexDuplicatePathId: RegExp = /\/(:\w+)(?:\[(?:09|AZ|AZ09)])?\/(?:.+\/)?(\1)(?:\[(?:09|AZ|AZ09)])?(?:\/|$)/g;
	private _regexSearchVariables: RegExp = /(?<=^|\/):(\w+)(?:\[(09|AZ|AZ09)])?(?=\/|$)/g;
	private _routes: Route[] = [];
	private _routeFunction403: Undefinedable<RouteFunction>;
	private _routeFunction404: Undefinedable<RouteFunction>;
	private _routeFunction500: Undefinedable<RouteFunction>;
	private _routing: boolean = false;
	private _queue: string[] = [];
	private _inTransition: boolean = false;
	private _currentState: Undefinedable<string>;
	private _states: { [ key: string ]: { OnEnter: FunctionOnEnter[], OnLeave: FunctionOnLeave[] } } = {};
	private _transitions: { [ key: string ]: { [ key: string ]: { OnBefore: FunctionOnTransitionBefore[], OnAfter: FunctionOnTransitionAfter[] } } } = {};
	private _window: Window;

	private constructor( window: Window ) {
		this._window = window;
		this._window.addEventListener( "hashchange", this.checkHash.bind( this ) );
	}

	private static _CheckRouteEquivalence( path1: string, path2: string ): boolean {
		const generateVariants: ( path: string ) => string[] = ( path: string ): string[ ] => {
			let returnValue: string[ ] = [ path ];
			if( path.includes( ':AZ09' ) ) {
				returnValue.push(
					...generateVariants( path.replace( /:AZ09/, ':AZ' ) ),
					...generateVariants( path.replace( /:AZ09/, ':09' ) )
				);
			}
			return returnValue;
		};
		const variants: Set<string> = new Set( generateVariants( path1 ) );
		return [ ...generateVariants( path2 ) ].some( x => variants.has( x ) );
	}

	public stateAdd( state: string ): boolean {
		let returnValue: boolean = false;
		if( !this._states[ state ] ) {
			this._states[ state ] = {
				OnEnter: [],
				OnLeave: []
			};
			this._transitions[ state ] = {};
			if( !this._currentState ) {
				this._currentState = state;
			}
			returnValue = true;
		}
		return returnValue;
	}

	public stateDel( state: string ): boolean {
		let returnValue: boolean = false;
		if( this._states[ state ] ) {
			delete this._states[ state ];
			if( this._transitions[ state ] ) {
				delete this._transitions[ state ];
			}
			for( const tmpState in this._transitions ) {
				if( this._transitions[ tmpState ][ state ] ) {
					delete this._transitions[ tmpState ][ state ];
				}
			}
			returnValue = true;
		}
		return returnValue;
	}

	public stateOnEnterAdd( state: string, func: FunctionOnEnter ): boolean {
		let returnValue: boolean = false;
		if( this._states[ state ] && !this._states[ state ].OnEnter.includes( func ) ) {
			this._states[ state ].OnEnter.push( func );
			returnValue = true;
		}
		return returnValue;
	}

	public stateOnEnterDel( state: string, func: FunctionOnEnter ): boolean {
		let returnValue: boolean = false;
		if( this._states[ state ] ) {
			const position: number = this._states[ state ].OnEnter.indexOf( func );
			if( -1 !== position ) {
				this._states[ state ].OnEnter.splice( position, 1 );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public stateOnLeaveAdd( state: string, func: FunctionOnLeave ): boolean {
		let returnValue: boolean = false;
		if( this._states[ state ] && !this._states[ state ].OnLeave.includes( func ) ) {
			this._states[ state ].OnLeave.push( func );
			returnValue = true;
		}
		return returnValue;
	}

	public stateOnLeaveDel( state: string, func: FunctionOnLeave ): boolean {
		let returnValue: boolean = false;
		if( this._states[ state ] ) {
			const position: number = this._states[ state ].OnLeave.indexOf( func );
			if( -1 !== position ) {
				this._states[ state ].OnLeave.splice( position, 1 );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public transitionAdd( from: string, to: string ): boolean {
		let returnValue: boolean = false;
		if( this._states[ from ] && this._states[ to ] && !this._transitions[ from ][ to ] ) {
			this._transitions[ from ][ to ] = {
				OnBefore: [],
				OnAfter: []
			};
			returnValue = true;
		}
		return returnValue;
	}

	public transitionDel( from: string, to: string ): boolean {
		let returnValue: boolean = false;
		if( this._states[ from ] && this._states[ to ] && this._transitions[ from ][ to ] ) {
			delete this._transitions[ from ][ to ];
			returnValue = true;
		}
		return returnValue;
	}

	public transitionOnBeforeAdd( from: string, to: string, func: FunctionOnTransitionBefore ): boolean {
		let returnValue: boolean = false;
		if( this._states[ from ] && this._states[ to ] && this._transitions[ from ][ to ] ) {
			this._transitions[ from ][ to ].OnBefore.push( func );
			returnValue = true;
		}
		return returnValue;
	}

	public transitionOnBeforeDel( from: string, to: string, func: FunctionOnTransitionBefore ): boolean {
		let returnValue: boolean = false;
		if( this._states[ from ] && this._states[ to ] && this._transitions[ from ][ to ] ) {
			const pos: number = this._transitions[ from ][ to ].OnBefore.indexOf( func );
			if( -1 !== pos ) {
				this._transitions[ from ][ to ].OnBefore.splice( pos, 1 );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public transitionOnAfterAdd( from: string, to: string, func: FunctionOnTransitionAfter ): boolean {
		let returnValue: boolean = false;
		if( this._states[ from ] && this._states[ to ] && this._transitions[ from ][ to ] ) {
			this._transitions[ from ][ to ].OnAfter.push( func );
			returnValue = true;
		}
		return returnValue;
	}

	public transitionOnAfterDel( from: string, to: string, func: FunctionOnTransitionAfter ): boolean {
		let returnValue: boolean = false;
		if( this._states[ from ] && this._states[ to ] && this._transitions[ from ][ to ] ) {
			const pos: number = this._transitions[ from ][ to ].OnAfter.indexOf( func );
			if( -1 !== pos ) {
				this._transitions[ from ][ to ].OnAfter.splice( pos, 1 );
				returnValue = true;
			}
		}
		return returnValue;
	}

	public get state(): Undefinedable<string> {
		return this._currentState;
	}

	public async stateSet( nextState: string ): Promise<boolean> {
		let returnValue: boolean = false;
		if( !this._inTransition ) {
			this._inTransition = true;
			if( this._currentState && this._states[ nextState ] && this._transitions[ this._currentState ] && this._transitions[ this._currentState ][ nextState ] ) {
				returnValue = true;
				// Check if I can enter the new state: in case a function return false, abort
				let cFL: number = this._transitions[ this._currentState ][ nextState ].OnBefore.length;
				for( let iFL: number = 0; ( returnValue && ( iFL < cFL ) ); iFL++ ) {
					if( 'function' === typeof this._transitions[ this._currentState ][ nextState ].OnBefore[ iFL ] ) {
						let tmpValue = null;
						if( 'AsyncFunction' === this._transitions[ this._currentState ][ nextState ].OnBefore[ iFL ].constructor.name ) {
							tmpValue = await this._transitions[ this._currentState ][ nextState ].OnBefore[ iFL ]();
						} else {
							tmpValue = this._transitions[ this._currentState ][ nextState ].OnBefore[ iFL ]();
						}
						returnValue = ( false !== tmpValue );
					}
				}
				if( returnValue ) {
					cFL = this._states[ this._currentState ].OnLeave.length;
					for( let iFL: number = 0; iFL < cFL; iFL++ ) {
						if( 'function' === typeof this._states[ this._currentState ].OnLeave[ iFL ] ) {
							if( 'AsyncFunction' === this._states[ this._currentState ].OnLeave[ iFL ].constructor.name ) {
								await this._states[ this._currentState ].OnLeave[ iFL ]( this._currentState, nextState );
							} else {
								this._states[ this._currentState ].OnLeave[ iFL ]( this._currentState, nextState );
							}
						}
					}
					let previousState: string = this._currentState;
					this._currentState = nextState;
					cFL = this._transitions[ previousState ][ this._currentState ].OnAfter.length;
					for( let iFL: number = 0; iFL < cFL; iFL++ ) {
						if( 'function' === typeof this._transitions[ previousState ][ this._currentState ].OnAfter[ iFL ] ) {
							if( 'AsyncFunction' === this._transitions[ previousState ][ this._currentState ].OnAfter[ iFL ].constructor.name ) {
								await this._transitions[ previousState ][ this._currentState ].OnAfter[ iFL ]();
							} else {
								this._transitions[ previousState ][ this._currentState ].OnAfter[ iFL ]();
							}
						}
					}
					cFL = this._states[ this._currentState ].OnEnter.length;
					for( let iFL: number = 0; iFL < cFL; iFL++ ) {
						if( 'function' === typeof this._states[ this._currentState ].OnEnter[ iFL ] ) {
							if( 'AsyncFunction' === this._states[ this._currentState ].OnEnter[ iFL ].constructor.name ) {
								await this._states[ this._currentState ].OnEnter[ iFL ]( this._currentState, previousState );
							} else {
								this._states[ this._currentState ].OnEnter[ iFL ]( this._currentState, previousState );
							}
						}
					}
				}
			}
			this._inTransition = false;
		}
		return returnValue;
	}

	public checkTransition( nextState: string ): boolean {
		return !!( !this._inTransition && this._currentState && this._states[ nextState ] && this._transitions[ this._currentState ] && this._transitions[ this._currentState ][ nextState ] );
	}

	public routeSpecialAdd( code: number, routeFunction: RouteFunction ) {
		let returnValue: boolean = false;
		switch( code ) {
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
			case 500: {
				this._routeFunction500 = routeFunction;
				returnValue = true;
				break;
			}
			default: {
				throw new RangeError();
			}
		}
		return returnValue;
	}

	public routeAdd( validState: string, path: string, routeFunction: RouteFunction, available?: CheckAvailability, routeFunction403?: RouteFunction ) {
		let returnValue: boolean = false;
		if( this._states[ validState ] ) {
			if( path.match( this._regexDuplicatePathId ) ) {
				throw new SyntaxError( 'Duplicate path id' );
			} else {
				let weight: number = 0;
				const regex: RegExp = new RegExp( '^' + path.replace( this._regexSearchVariables,
					function( _unused: string, name: string, type: string ): string {
						let returnValue = '(?<' + name + '>[';
						switch( type ) {
							case '09': {
								returnValue += '\\d';
								break;
							}
							case 'AZ': {
								returnValue += 'a-zA-Z';
								break;
							}
							case 'AZ09':
							default: {
								returnValue += 'a-zA-Z\\d';
							}
						}
						returnValue += ']+)';
						return returnValue;
					} ).replace( /\//g, '\\\/' ) + '$' );
				const reducedPath = path.replace(
					this._regexSearchVariables,
					( _, __, component ) => `:${ component ?? 'AZ09' }`
				);
				const paths: string[] = path.split( '/' );
				const cFL: number = paths.length;
				for( let iFL: number = 0; iFL < cFL; iFL++ ) {
					if( !paths[ iFL ].startsWith( ':' ) ) {
						weight += 2 ** ( cFL - iFL - 1 );
					}
				}
				if( !this._routes.find( ( route: Route ): boolean => jFSMRouter._CheckRouteEquivalence( reducedPath, route.path ) ) ) {
					this._routes.push( {
						path: reducedPath,
						validState: validState,
						match: regex,
						weight: weight,
						routeFunction: routeFunction,
						available: available,
						routeFunction403: routeFunction403
					} );
					this._routes.sort(
						( a, b ) => ( ( a.weight > b.weight ) ? -1 : ( ( b.weight > a.weight ) ? 1 : 0 ) )
					);
					returnValue = true;
				}
			}
		} else {
			throw new SyntaxError( 'Non-existent state' );
		}
		return returnValue;
	}

	public routeDel( path: string ): boolean {
		let returnValue: boolean = false;
		if( !path.match( this._regexDuplicatePathId ) ) {
			const reducedPath: string = path.replace(
				this._regexSearchVariables,
				( _, __, component ) => `:${ component ?? 'AZ09' }`
			);
			const index: number = this._routes.findIndex( ( route: Route ): boolean => jFSMRouter._CheckRouteEquivalence( reducedPath, route.path ) );
			if( -1 < index ) {
				this._routes.splice( index, 1 );
				returnValue = true;
			}
		} else {
			throw new SyntaxError( 'Duplicate path id' );
		}
		return returnValue;
	}

	public trigger( path: string ): void {
		if( '#' + path != this._window.location.hash ) {
			this._window.location.hash = '#' + path;
		}
	}

	public async route( path: string ): Promise<void> {
		this._routing = true;
		let routeFunction: Undefinedable<RouteFunction>;
		let routePath: string = '';
		let result: Nullable<RegExpExecArray> = null;
		for( const route of this._routes ) {
			if( ( result = route.match.exec( path ) ) ) {
				routePath = route.path;
				let available: boolean = true;
				if( route.available ) {
					if( 'function' === typeof route.available ) {
						if( 'AsyncFunction' === route.available.constructor.name ) {
							available = await route.available( routePath, path, ( result.groups ?? {} ) );
						} else {
							// @ts-ignore
							available = route.available( routePath, path, ( result.groups ?? {} ) );
						}
					} else {
						available = false;
					}
				}
				if( available ) {
					if( !route.validState || ( this._currentState === route.validState ) ) {
						routeFunction = route.routeFunction;
					} else if( this._routeFunction500 ) {
						routeFunction = this._routeFunction500;
					}
				} else if( route.routeFunction403 ) {
					routeFunction = route.routeFunction403;
				} else if( this._routeFunction403 ) {
					routeFunction = this._routeFunction403;
				}
				break;
			}
		}
		if( !routeFunction && this._routeFunction404 ) {
			routeFunction = this._routeFunction404;
		}
		if( ( 'function' !== typeof routeFunction ) && this._routeFunction500 ) {
			routeFunction = this._routeFunction500;
		}
		if( routeFunction && ( 'function' === typeof routeFunction ) ) {
			if( 'AsyncFunction' === routeFunction.constructor.name ) {
				await routeFunction( routePath, path, ( result?.groups ?? {} ) );
			} else {
				routeFunction( routePath, path, ( result?.groups ?? {} ) );
			}
		}
		if( this._queue.length ) {
			await this.route( this._queue.shift()! );
		} else {
			this._routing = false;
		}
	}

	public async checkHash(): Promise<void> {
		const hash: string = ( this._window.location.hash.startsWith( '#' ) ? this._window.location.hash.substring( 1 ) : '' );
		if( '' != hash ) {
			if( this._routing ) {
				this._queue.push( hash );
			} else {
				await this.route( hash );
			}
		}
	}
}

export default jFSMRouter.instance;
