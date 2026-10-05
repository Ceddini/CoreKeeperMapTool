import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/layout.css';
import { startApp } from './app/app.ts';

const root = document.getElementById('app')!;
startApp(root)
  .catch((err: unknown) => {
    console.error(err);
    root.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'fatal';
    box.setAttribute('role', 'alert');
    const h = document.createElement('h1');
    h.textContent = 'Something went wrong while starting the map tool.';
    const p = document.createElement('p');
    p.textContent =
      'Please reload the page. If this keeps happening, clear the site data for this page or report it on GitHub.';
    box.append(h, p);
    root.append(box);
  })
  .finally(() => document.documentElement.classList.remove('is-booting'));
