# jFSMRouter
JavaScript Finite State Machine Router

`jFSMRouter` (JavaScript Finite State Machine Router) is a JavaScript class that implements a **Finite State Machine** (FSM) integrated with a **hash-based router** for browsers. It allows centralized management of states, transitions, and routes.

## 1. Singleton Instance

The class uses the Singleton pattern: only one global instance exists, which you can access with:

```js
import router from 'https://cdn.jsdelivr.net/gh/StefanoBalocco/jFSMRouter@2.0.0/jFSMRouter.min.js';
```

## 2. States

States represent the logical steps of your application.

### 2.1 Add a State

```js
router.stateAdd('home');  // Adds the "home" state
```

- Returns `true` if the state is successfully created.
- The first state added becomes the initial current state.

### 2.2 Remove a State

```js
router.stateDel('home');   // Removes the "home" state
```

### 2.3 Handle Entry and Exit Hooks

- **OnEnter**: functions called when entering a state.
- **OnLeave**: functions called when leaving a state.

```js
function onEnter(prev, next) { console.log(`Entering ${next}`); }
function onLeave(curr, next) { console.log(`Leaving ${curr}`); }

router.stateOnEnterAdd('home', onEnter);
router.stateOnLeaveAdd('home', onLeave);
```

To remove hooks:

```js
router.stateOnEnterDel('home', onEnter);
router.stateOnLeaveDel('home', onLeave);
```

## 3. Transitions

Transitions define permissions and hooks between two states.

### 3.1 Add a Transition

```js
router.transitionAdd('home', 'about');
```

### 3.2 Remove a Transition

```js
router.transitionDel('home', 'about');
```

### 3.3 Transition Hooks

- **OnBefore**: called before transitioning, can block it by returning `false`.
- **OnAfter**: called after the state change.

```js
function before() { return confirm('Go to the About page?'); }
async function after() { console.log('Transition completed'); }

router.transitionOnBeforeAdd('home', 'about', before);
router.transitionOnAfterAdd('home', 'about', after);
```

To remove hooks:

```js
router.transitionOnBeforeDel('home', 'about', before);
router.transitionOnAfterDel('home', 'about', after);
```

## 4. Hash-Based Routing

Each route is associated with a valid state.

### 4.1 Add a Route

```js
// path: '/user/:id[09]'
router.routeAdd(
  'home',                   // required state
  '/user/:id[09]',          // path with variables
  (pathDef, actual, vars) => { console.log(vars.id); },
  () => true,               // optional availability function
  (pathDef, actual, vars) => { console.warn('Access denied'); }  // 403
);
```

- **path** may include variables like `:name[AZ09]`, `:num[09]`, `:str[AZ]`.
- **routeFunction**: callback called if all checks pass.
- **available**: sync or async function to allow/deny the route.
- **routeFunction403**: callback called in case of access denial (403).

### 4.2 Remove a Route

```js
router.routeDel('/user/:id[09]');
```

### 4.3 Special Routes

```js
router.routeSpecialAdd(404, () => { /* page not found */ });
router.routeSpecialAdd(403, () => { /* access denied */ });
router.routeSpecialAdd(500, () => { /* internal error */ });
```

### 4.4 Manual trigger

To force navigation:

```js
router.trigger('user/123'); // sets the hash and triggers routing
```

## 5. Internal Mechanism

- The `hashchange` listener calls `checkHash()`.
- More specific paths (higher weight) take priority.
- FSM handles the proper hook sequence: OnBefore → OnLeave → OnAfter → OnEnter.

## 6. Complete Example

```html
<!DOCTYPE html>
<html>
<head><title>jFSMRouter Demo</title></head>
<body>
<script type="module">
  import router from 'https://example.org/jFSMRouter.js';

  // Define states
  router.stateAdd('home');
  router.stateAdd('user');

  // State hooks
  router.stateOnEnterAdd('home', () => console.log('Entered Home'));
  router.stateOnEnterAdd('user', (_, prev) => console.log(`User ${prev}→user`));

  // Transitions
  router.transitionAdd('home', 'user');

  // Routing
  router.routeSpecialAdd(404, () => document.body.innerHTML = '<h1>404 Not Found</h1>');
  router.routeAdd(
    'home', '/home', () => alert('Welcome!')
  );
  router.routeAdd(
    'user', '/user/:id[09]', (pd, act, { id }) =>
      document.body.innerHTML = `<h1>User ${id}</h1>`
  );

  // Initial startup (if hash already present)
  router.checkHash();
</script>
</body>
</html>
```

---

**Notes**:
- Uses ES Module syntax for import.
- Hook handling supports both sync and async functions.
- Avoid duplicate variable IDs in a single path (throws `Duplicate path id` exception).
