// Widget Decap CMS "html" : éditeur visuel (WYSIWYG) qui enregistre le HTML tel quel.
// Objectif : permettre à l'utilisatrice de modifier le texte sans voir de balises,
// tout en conservant exactement les classes de style du site (couleurs, encadrés, etc.).

(function () {
  'use strict';

  if (typeof CMS === 'undefined' || typeof createClass === 'undefined' || typeof h === 'undefined') {
    console.warn('Widget html : Decap CMS non disponible.');
    return;
  }

  var HtmlControl = createClass({
    componentDidMount: function () {
      // Les nouvelles lignes créées avec Entrée seront des paragraphes <p> (comme sur le site).
      try {
        document.execCommand('defaultParagraphSeparator', false, 'p');
      } catch (e) {
        /* certains navigateurs ne supportent pas cette commande */
      }
      this.syncFromProps();
    },

    componentDidUpdate: function (prevProps) {
      // Si la valeur change ailleurs que dans notre éditeur (changement de page, rechargement),
      // on réaffiche le contenu. On évite d'écraser la saisie en cours.
      if (prevProps.value !== this.props.value && this.props.value !== this.lastEmitted) {
        this.syncFromProps();
      }
    },

    syncFromProps: function () {
      var el = this.editor;
      if (!el) return;
      var html = this.props.value == null ? '' : String(this.props.value);
      if (el.innerHTML !== html) el.innerHTML = html;
    },

    exec: function (command, arg) {
      var el = this.editor;
      if (!el) return;
      el.focus();
      try {
        document.execCommand(command, false, arg || null);
      } catch (e) {
        console.warn('Commande éditeur non disponible :', command);
      }
      this.emit();
    },

    emit: function () {
      var el = this.editor;
      if (!el) return;
      this.lastEmitted = el.innerHTML;
      this.props.onChange(this.lastEmitted);
    },

    handleInput: function () {
      this.emit();
    },

    // Met le texte sélectionné en violet avec la classe exacte du site.
    wrapViolet: function () {
      var el = this.editor;
      if (!el) return;
      el.focus();
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
      var range = sel.getRangeAt(0);
      var span = document.createElement('span');
      span.className = 'accent-violet';
      try {
        range.surroundContents(span);
      } catch (e) {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
      sel.removeAllRanges();
      var newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
      this.emit();
    },

    // Mémorise la sélection avant d'ouvrir un sélecteur de couleur.
    saveSelection: function () {
      var el = this.editor;
      var sel = window.getSelection();
      if (!el || !sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) this.savedRange = range.cloneRange();
    },

    restoreSelection: function () {
      var el = this.editor;
      if (!el) return null;
      var range = this.savedRange;
      if (!range) {
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        range = sel.getRangeAt(0);
      }
      if (!el.contains(range.commonAncestorContainer)) return null;
      el.focus();
      var sel2 = window.getSelection();
      sel2.removeAllRanges();
      sel2.addRange(range);
      return range;
    },

    // Applique une couleur de texte ou de fond au passage sélectionné.
    applyColor: function (kind, color) {
      var range = this.restoreSelection();
      if (!range || range.collapsed) return;
      var span = document.createElement('span');
      if (kind === 'background') {
        span.style.backgroundColor = color;
      } else {
        span.style.color = color;
      }
      try {
        range.surroundContents(span);
      } catch (e) {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
      var sel = window.getSelection();
      sel.removeAllRanges();
      var newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
      this.savedRange = newRange.cloneRange();
      this.emit();
    },

    colorButton: function (title, icon, inputName) {
      var self = this;
      return h(
        'button',
        {
          type: 'button',
          title: title,
          onMouseDown: function (e) {
            e.preventDefault();
            self.saveSelection();
          },
          onClick: function () {
            self.saveSelection();
            var input = self[inputName];
            if (input) input.click();
          },
          style: {
            background: '#fff',
            border: '1px solid #c9c9c9',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '30px',
            minWidth: '34px',
            padding: '3px 7px',
            marginRight: '4px',
            marginBottom: '4px',
          },
        },
        icon
      );
    },

    button: function (label, title, command, arg) {
      var self = this;
      return h(
        'button',
        {
          type: 'button',
          title: title,
          onMouseDown: function (e) {
            e.preventDefault();
          },
          onClick: function () {
            self.exec(command, arg);
          },
          style: {
            background: '#fff',
            border: '1px solid #c9c9c9',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            lineHeight: '1',
            minWidth: '30px',
            padding: '7px 9px',
            marginRight: '4px',
            marginBottom: '4px',
          },
        },
        label
      );
    },

    render: function () {
      var self = this;

      // Icône « couleur du texte » : un A souligné de la couleur choisie.
      var textColorIcon = h(
        'span',
        { style: { display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1' } },
        h('span', { style: { fontSize: '14px', fontWeight: 'bold' } }, 'A'),
        h('span', {
          style: {
            width: '15px',
            height: '4px',
            background: '#ea39c1',
            borderRadius: '2px',
            marginTop: '1px',
          },
        })
      );

      // Icône « couleur de fond » : un A sur un fond coloré.
      var bgColorIcon = h(
        'span',
        {
          style: {
            display: 'inline-block',
            background: '#f3d9ef',
            border: '1px solid #999',
            borderRadius: '3px',
            fontSize: '13px',
            fontWeight: 'bold',
            lineHeight: '1',
            padding: '2px 4px',
          },
        },
        'A'
      );

      return h(
        'div',
        { className: this.props.classNameWrapper },
        h(
          'div',
          {
            style: {
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '6px',
            },
          },
          this.button('G', 'Gras', 'bold'),
          this.button('I', 'Italique', 'italic'),
          this.button('U', 'Souligné', 'underline'),
          this.button('• Liste', 'Liste à puces', 'insertUnorderedList'),
          this.button('1. Liste', 'Liste numérotée', 'insertOrderedList'),
          this.button('H3', 'Titre de section', 'formatBlock', 'H3'),
          this.button('H4', 'Sous-titre', 'formatBlock', 'H4'),
          this.button('Titre normal', 'Revenir au texte normal', 'formatBlock', 'P'),
          h(
            'button',
            {
              type: 'button',
              title: 'Mettre le texte sélectionné en violet',
              onMouseDown: function (e) {
                e.preventDefault();
              },
              onClick: function () {
                self.wrapViolet();
              },
              style: {
                background: '#ea39c1',
                border: '1px solid #c026a0',
                borderRadius: '4px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
                lineHeight: '1',
                padding: '7px 9px',
                marginRight: '4px',
                marginBottom: '4px',
              },
            },
            'Violet'
          ),
          this.colorButton('Couleur du texte', textColorIcon, 'textColorInput'),
          this.colorButton('Couleur de fond du texte', bgColorIcon, 'bgColorInput'),
          h('input', {
            type: 'color',
            defaultValue: '#ea39c1',
            ref: function (el) {
              self.textColorInput = el;
              if (el && !el.__colorBound) {
                el.__colorBound = true;
                el.addEventListener('change', function (e) {
                  self.applyColor('text', e.target.value);
                });
              }
            },
            style: {
              position: 'fixed',
              left: '-9999px',
              top: '0',
              width: '1px',
              height: '1px',
              opacity: 0,
            },
          }),
          h('input', {
            type: 'color',
            defaultValue: '#f3d9ef',
            ref: function (el) {
              self.bgColorInput = el;
              if (el && !el.__colorBound) {
                el.__colorBound = true;
                el.addEventListener('change', function (e) {
                  self.applyColor('background', e.target.value);
                });
              }
            },
            style: {
              position: 'fixed',
              left: '-9999px',
              top: '0',
              width: '1px',
              height: '1px',
              opacity: 0,
            },
          })
        ),
        h('div', {
          ref: function (el) {
            self.editor = el;
          },
          contentEditable: true,
          suppressContentEditableWarning: true,
          className: 'html-widget-editor',
          onInput: this.handleInput,
          onBlur: this.handleInput,
          spellCheck: true,
          style: {
            background: '#fff',
            border: '1px solid #c9c9c9',
            borderRadius: '4px',
            color: '#222',
            lineHeight: '1.6',
            minHeight: '180px',
            overflowY: 'auto',
            padding: '14px',
          },
        })
      );
    },
  });

  var HtmlPreview = createClass({
    render: function () {
      return h('div', {
        dangerouslySetInnerHTML: { __html: this.props.value == null ? '' : String(this.props.value) },
      });
    },
  });

  CMS.registerWidget('html', HtmlControl, HtmlPreview);
})();
