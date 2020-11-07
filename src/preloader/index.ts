import {PreloaderOptions} from './types';

/** Отключает лоадер после загрузки всех объектов */
export class Preloader {
	preloaderDomElem = document.getElementsByClassName('loader')[0];
	preloaderHiddenClassName = 'loader_hidden';

	constructor(options: PreloaderOptions) {
		options.manager.onLoad = (): void => {
            this.onComplete();
            options.onComplete();
        };
        
		options.manager.onError = (url): void =>  {
			console.log('There was an error loading ' + url);
		};

	}

	onComplete(): void {
        this.preloaderDomElem.classList.add(this.preloaderHiddenClassName);
	}
}