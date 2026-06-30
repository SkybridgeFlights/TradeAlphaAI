'use strict';

// Helpers to build a ProseMirror JSON document for Substack's draft_body.
//
// Substack uses TipTap on top of ProseMirror. The schema here covers the
// node/mark types we actually need for a daily digest: heading, paragraph,
// bullet_list, list_item, horizontal_rule, hard_break + bold/italic/link marks.
// Anything fancier (images, embeds, footnotes) would need extra node defs.

function textNode(text, marks) {
  const node = { type: 'text', text: String(text) };
  if (marks && marks.length) node.marks = marks;
  return node;
}

function linkMark(href) {
  return { type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer nofollow' } };
}

function paragraph(content) {
  return { type: 'paragraph', content: Array.isArray(content) ? content : [content] };
}

function heading(level, text) {
  return { type: 'heading', attrs: { level }, content: [textNode(text)] };
}

function divider() {
  return { type: 'horizontal_rule' };
}

function bulletList(items) {
  return {
    type: 'bullet_list',
    content: items.map((it) => ({
      type: 'list_item',
      content: [paragraph(Array.isArray(it) ? it : [textNode(it)])]
    }))
  };
}

// Convenience: paragraph with a link in it ("Read: <Title>").
function linkLine(prefix, label, href) {
  const nodes = [];
  if (prefix) nodes.push(textNode(prefix));
  nodes.push(textNode(label, [linkMark(href)]));
  return paragraph(nodes);
}

function doc(blocks) {
  return { type: 'doc', content: blocks.filter(Boolean) };
}

module.exports = {
  textNode, linkMark, paragraph, heading, divider, bulletList, linkLine, doc
};
