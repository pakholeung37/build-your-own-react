var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
/** @jsx Didact.createElement */
var ElementType = {
    TEXT_ELEMENT: 'TEXT_ELEMENT'
};
var EffectTag = {
    UPDATE: 'UPDATE',
    PLACEMENT: 'PLACEMENT',
    DELETION: 'DELETION'
};
var nextUnitOfWork = null;
var wipRoot = null;
var currentRoot = null;
var deletions = null;
// @ts-ignore
var requestIdleCallback = window.requestIdleCallback;
function createElement(type, props) {
    var children = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        children[_i - 2] = arguments[_i];
    }
    return {
        type: type,
        props: __assign(__assign({}, props), { children: children.map(function (child) {
                return typeof child === 'object'
                    ? child
                    : createTextElement(child);
            }) })
    };
}
function createTextElement(text) {
    return {
        type: ElementType.TEXT_ELEMENT,
        props: {
            nodeValue: text,
            children: []
        }
    };
}
function createDom(fiber) {
    var dom = fiber.type == ElementType.TEXT_ELEMENT
        ? document.createTextNode("")
        : document.createElement(fiber.type);
    updateDom(dom, {}, fiber.props);
    return dom;
}
function updateDom(dom, prevProps, nextProps) {
    var isProperty = function (key) { return key !== "children"; };
    var isNew = function (prev, next) { return function (key) {
        return prev[key] !== next[key];
    }; };
    var isGone = function (prev, next) { return function (key) { return !(key in next); }; };
    var isEvent = function (key) { return key.startsWith('on'); };
    //Remove old or changed event listeners
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(function (key) {
        return !(key in nextProps) ||
            isNew(prevProps, nextProps)(key);
    })
        .forEach(function (name) {
        var eventType = name
            .toLowerCase()
            .substring(2);
        dom.removeEventListener(eventType, prevProps[name]);
    });
    // Remove old properties
    Object.keys(prevProps)
        .filter(isProperty)
        .filter(isGone(prevProps, nextProps))
        .forEach(function (name) {
        dom[name] = '';
    });
    // Set new or changed properties
    Object.keys(nextProps)
        .filter(isProperty)
        .filter(isNew(prevProps, nextProps))
        .forEach(function (name) {
        dom[name] = nextProps[name];
    });
    // Add event listeners
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(function (name) {
        var eventType = name
            .toLowerCase()
            .substring(2);
        dom.addEventListener(eventType, nextProps[name]);
    });
}
function commitDeletion(fiber, domParent) {
    if (fiber.dom) {
        domParent.removeChild(fiber.dom);
    }
    else {
        commitDeletion(fiber.child, domParent);
    }
}
function commitWork(fiber) {
    if (!fiber) {
        return;
    }
    // find the nearest real domFiber
    var domParentFiber = fiber.parent;
    while (!domParentFiber.dom) {
        domParentFiber = domParentFiber.parent;
    }
    var domParent = domParentFiber.dom;
    if (fiber.effectTag === "PLACEMENT" &&
        fiber.dom != null) {
        domParent.appendChild(fiber.dom);
    }
    else if (fiber.effectTag === "UPDATE" &&
        fiber.dom != null) {
        updateDom(fiber.dom, fiber.alternate.props, fiber.props);
    }
    else if (fiber.effectTag === "DELETION") {
        // delete the nearest real dom child from the parent dom node
        commitDeletion(fiber, domParent);
    }
    commitWork(fiber.child);
    commitWork(fiber.sibling);
}
function commitRoot() {
    deletions.forEach(function (fiber) { return commitWork(fiber); });
    commitWork(wipRoot.child);
    currentRoot = wipRoot;
    wipRoot = null;
}
function workLoop(deadline) {
    var shouldYield = false;
    while (nextUnitOfWork && !shouldYield) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
        console.log("workLoop - nextUnitOfWork: ", nextUnitOfWork);
        shouldYield = deadline.timeRemaining() < 4;
    }
    if (!nextUnitOfWork && wipRoot) {
        commitRoot();
    }
    requestIdleCallback(workLoop);
}
requestIdleCallback(workLoop);
function reconcileChildren(wipFiber, elements) {
    var index = 0;
    var oldFiber = wipFiber.alternate && wipFiber.alternate.child;
    var prevSibling = null;
    while (index < elements.length ||
        oldFiber != null) {
        var element = elements[index];
        var newFiber = null;
        var sameType = oldFiber &&
            element &&
            element.type == oldFiber.type;
        if (sameType) {
            newFiber = {
                type: oldFiber.type,
                props: element.props,
                dom: oldFiber.dom,
                parent: wipFiber,
                alternate: oldFiber,
                effectTag: "UPDATE"
            };
        }
        if (element && !sameType) {
            newFiber = {
                type: element.type,
                props: element.props,
                dom: null,
                parent: wipFiber,
                alternate: null,
                effectTag: "PLACEMENT"
            };
        }
        if (oldFiber && !sameType) {
            oldFiber.effectTag = "DELETION";
            deletions.push(oldFiber);
        }
        if (oldFiber) {
            oldFiber = oldFiber.sibling;
        }
        if (index === 0) {
            wipFiber.child = newFiber;
        }
        else if (element) {
            prevSibling.sibling = newFiber;
        }
        prevSibling = newFiber;
        index++;
    }
}
function updateFunctionComponent(fiber) {
    var children = [fiber.type(fiber.props)];
    reconcileChildren(fiber, children);
}
function updateHostComponent(fiber) {
    if (!fiber.dom) {
        fiber.dom = createDom(fiber);
    }
    reconcileChildren(fiber, fiber.props.children);
}
function performUnitOfWork(fiber) {
    var isFunctionComponent = typeof fiber.type === 'function';
    if (isFunctionComponent) {
        updateFunctionComponent(fiber);
    }
    else {
        updateHostComponent(fiber);
    }
    // find the next fiber to perform
    if (fiber.child) {
        return fiber.child;
    }
    var nextFiber = fiber;
    while (nextFiber) {
        if (nextFiber.sibling) {
            return nextFiber.sibling;
        }
        nextFiber = nextFiber.parent;
    }
}
function render(element, container) {
    wipRoot = {
        dom: container,
        props: {
            children: [element]
        },
        alternate: currentRoot
    };
    deletions = [];
    nextUnitOfWork = wipRoot;
}
var Didact = {
    createElement: createElement,
    render: render
};
var container = document.getElementById("root");
function App(props) {
    return Didact.createElement("div", null,
        Didact.createElement("input", { value: props.value }),
        Didact.createElement("h2", null,
            "hello ",
            props.name));
}
Didact.render(Didact.createElement(App, { name: "world", value: "hha" }), container);
