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
      var el = this.refs.editor;
      if (!el) return;
      var html = this.props.value == null ? '' : String(this.props.value);
      if (el.innerHTML !== html) el.innerHTML = html;
    },

    exec: function (command, arg) {
      var el = this.refs.editor;
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
      var el = this.refs.editor;
      if (!el) return;
      this.lastEmitted = el.innerHTML;
      this.props.onChange(this.lastEmitted);
    },

    handleInput: function () {
      this.emit();
    },

    // Met le texte sélectionné en violet avec la classe exacte du site.
    wrapViolet: function () {
      var el = this.refs.editor;
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
          )
        ),
        h('div', {
          ref: 'editor',
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
