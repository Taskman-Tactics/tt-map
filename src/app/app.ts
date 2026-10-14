import { Component } from '@angular/core';
import { BoardMap } from './board/board-map';

@Component({
  imports: [BoardMap],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
