import { Routes } from '@angular/router';
import { BoardMap } from './board/board-map';
import { TerritoryAuthor } from './territory/territory-author';

export const routes: Routes = [
  { path: '', component: BoardMap },
  { path: 'author', component: TerritoryAuthor },
];
