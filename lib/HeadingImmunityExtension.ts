import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Node as PMNode, Schema, Fragment } from '@tiptap/pm/model';

function cleanHeadingMarks(headingNode: PMNode, schema: Schema): PMNode {
  const cleanedChildren: PMNode[] = [];
  let headingChanged = false;

  headingNode.forEach((child) => {
    if (child.isText) {
      const originalMarks = child.marks;
      const cleanedMarks = originalMarks.filter((mark) => {
        if (mark.type.name === 'textStyle') {
          const attrs = mark.attrs;
          if (attrs && (attrs.fontSize || attrs.fontFamily)) {
            return false; // strip size/family
          }
          return true;
        }
        // Strip other marks like bold/italic/underline/strikethrough unless it is color
        if (mark.type.name !== 'color') {
          return false;
        }
        return true;
      });

      const isChanged = originalMarks.length !== cleanedMarks.length ||
        cleanedMarks.some((m, idx) => m !== originalMarks[idx]);

      if (isChanged) {
        headingChanged = true;
        cleanedChildren.push(child.mark(cleanedMarks as any));
      } else {
        cleanedChildren.push(child);
      }
    } else {
      cleanedChildren.push(child);
    }
  });

  if (headingChanged) {
    return headingNode.type.create(headingNode.attrs, Fragment.fromArray(cleanedChildren));
  }
  return headingNode;
}

function flattenList(listNode: PMNode, schema: Schema): PMNode[] {
  let hasHeadingAnywhere = false;
  listNode.descendants((node) => {
    if (node.type.name === 'heading') {
      hasHeadingAnywhere = true;
    }
  });

  if (!hasHeadingAnywhere) {
    return [listNode];
  }

  const resultBlocks: PMNode[] = [];
  let currentListItems: PMNode[] = [];

  const closeCurrentList = () => {
    if (currentListItems.length > 0) {
      resultBlocks.push(
        listNode.type.create(listNode.attrs, Fragment.fromArray(currentListItems))
      );
      currentListItems = [];
    }
  };

  listNode.forEach((itemNode) => {
    let hasHeading = false;
    itemNode.descendants((node) => {
      if (node.type.name === 'heading') {
        hasHeading = true;
      }
    });

    if (!hasHeading) {
      currentListItems.push(itemNode);
    } else {
      closeCurrentList();

      const precedingBlocks: PMNode[] = [];
      const headingBlocks: PMNode[] = [];
      const succeedingBlocks: PMNode[] = [];

      let foundHeading = false;
      itemNode.forEach((blockChild) => {
        if (blockChild.type.name === 'heading') {
          foundHeading = true;
          headingBlocks.push(cleanHeadingMarks(blockChild, schema));
        } else if (!foundHeading) {
          precedingBlocks.push(blockChild);
        } else {
          succeedingBlocks.push(blockChild);
        }
      });

      if (precedingBlocks.length > 0) {
        resultBlocks.push(
          listNode.type.create(
            listNode.attrs,
            Fragment.from(itemNode.type.create(itemNode.attrs, Fragment.fromArray(precedingBlocks)))
          )
        );
      }

      resultBlocks.push(...headingBlocks);

      if (succeedingBlocks.length > 0) {
        currentListItems.push(
          itemNode.type.create(itemNode.attrs, Fragment.fromArray(succeedingBlocks))
        );
      }
    }
  });

  closeCurrentList();
  return resultBlocks;
}

function cleanAndFlattenDoc(doc: PMNode, schema: Schema): PMNode {
  const newBlocks: PMNode[] = [];
  let docChanged = false;

  doc.forEach((childNode) => {
    if (
      childNode.type.name === 'bulletList' ||
      childNode.type.name === 'orderedList' ||
      childNode.type.name === 'taskList'
    ) {
      const flattened = flattenList(childNode, schema);
      if (
        flattened.length !== 1 ||
        flattened[0] !== childNode ||
        flattened[0].content.size !== childNode.content.size
      ) {
        docChanged = true;
      }
      newBlocks.push(...flattened);
    } else if (childNode.type.name === 'heading') {
      const cleaned = cleanHeadingMarks(childNode, schema);
      if (cleaned !== childNode) {
        docChanged = true;
      }
      newBlocks.push(cleaned);
    } else {
      newBlocks.push(childNode);
    }
  });

  if (docChanged) {
    return schema.nodes.doc.create(null, Fragment.fromArray(newBlocks));
  }
  return doc;
}

export const HeadingImmunity = Extension.create({
  name: 'headingImmunity',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('headingImmunity'),
        appendTransaction(transactions, oldState, newState) {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) {
            return null;
          }

          const cleanedDoc = cleanAndFlattenDoc(newState.doc, newState.schema);
          if (cleanedDoc !== newState.doc) {
            const tr = newState.tr;
            tr.replaceWith(0, newState.doc.content.size, cleanedDoc.content);
            const mappedSelection = newState.selection.map(tr.doc, tr.mapping);
            tr.setSelection(mappedSelection);
            return tr;
          }

          return null;
        },
      }),
    ];
  },
});
