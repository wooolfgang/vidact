import { Scope } from "@babel/traverse";
import * as t from "@babel/types";

import { ELEMENT_VAR } from "../constants";
import isNativeTag from "../utils/isNativeTag";
import { JSXState } from "../plugin";

const multiSpaceRegex = /[\s\r\n]{2,}/g;
const LEFT = 1;
const RIGHT = 2;

export function shallowTraverseJSXElement(
  element:
    | t.JSXText
    | t.JSXExpressionContainer
    | t.JSXSpreadChild
    | t.JSXElement
    | t.JSXFragment
    | t.JSXEmptyExpression,
  state: JSXState,
  scope: Scope,
  namePrefix = ELEMENT_VAR,
  shouldTrim: 0 | typeof LEFT | typeof RIGHT = 0
) {
  const identifier = scope.generateUidIdentifier(namePrefix);

  switch (element.type) {
    case "JSXElement":
      const tagIdentifier = element.openingElement.name as t.JSXIdentifier;
      let children = element.children
        .map((child, i) => {
          const shouldTrimNext =
            (i === 0 && LEFT) || (i === element.children.length - 1 && RIGHT);

          return shallowTraverseJSXElement(
            child,
            state,
            scope,
            identifier.name,
            shouldTrimNext
          );
        })
        .filter(value => value);
      const isNative = isNativeTag(tagIdentifier.name);
      let { attributes } = element.openingElement;
      if (!isNative) {
        if (children && children.length > 0) {
          attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier("children"),
              t.jsxExpressionContainer(
                children.length === 1
                  ? children[0]
                  : t.arrayExpression(children)
              )
            )
          );
          children = [];
        }
      }

      state.elements.push({
        type: "node",
        tag: tagIdentifier.name,
        attributes: element.openingElement.attributes,
        isNative,
        identifier,
        children
      });
      break;
    case "JSXText":
      let value = element.value.replace(multiSpaceRegex, " ");
      if (shouldTrim) {
        if (value.trim() === "") {
          return undefined;
        } else if (shouldTrim === LEFT) {
          value = value.trimLeft();
        } else if (shouldTrim === RIGHT) {
          value = value.trimRight();
        }
      }

      state.elements.push({
        type: "text",
        identifier,
        value
      });
      break;
    case "JSXExpressionContainer":
      state.elements.push({
        type: "expr",
        expression: element.expression,
        identifier
      });
      break;
    default:
      console.warn("Unsupported JSX child", element);
  }

  return identifier;
}
