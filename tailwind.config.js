/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Montserrat', 'sans-serif']
			},
			colors: {
				// Theme colours: overridden by Hub Settings theme (CSS vars set in root layout)
				primary: 'var(--color-primary, #4BB170)', // Green (main brand color)
				'primary-dark': '#3a8a56',
				'brand-blue': 'var(--color-brand, #4A97D2)',
				// Navbar, buttons (up to 5), panel heads (up to 3)
				'theme-navbar': 'var(--color-navbar-bg, #4A97D2)',
				'theme-button': {
					1: 'var(--color-button-1, #4A97D2)',
					2: 'var(--color-button-2, #4BB170)',
					3: 'var(--color-button-3, #3B79A8)',
					4: 'var(--color-button-4, #3C8E5A)',
					5: 'var(--color-button-5, #E6A324)'
				},
				'theme-panel-head': {
					1: 'var(--color-panel-head-1, #4A97D2)',
					2: 'var(--color-panel-head-2, #3B79A8)',
					3: 'var(--color-panel-head-3, #2C5B7E)'
				},
				'theme-panel-bg': 'var(--color-panel-bg, #E8F2F9)',
				'brand-green': '#4BB170',
				'brand-yellow': '#E6A324',
				'brand-red': '#A62524',
				'brand-peach': '#F4A460',
				'dark-gray': '#252525',
				'medium-gray': '#353535',
				'light-gray': '#757575',
				// Pastel variants for Hub UI
				'hub-blue': {
					50: '#E8F2F9',
					100: '#D1E5F3',
					200: '#A3CBE7',
					300: '#75B1DB',
					400: '#5FA4D4',
					500: '#4A97D2', // brand-blue
					600: '#3B79A8',
					700: '#2C5B7E',
					800: '#1E3D54',
					900: '#0F1F2A'
				},
				'hub-green': {
					50: '#E8F5ED',
					100: '#D1EBDC',
					200: '#A3D7B9',
					300: '#75C396',
					400: '#5FB37D',
					500: '#4BB170', // brand-green
					600: '#3C8E5A',
					700: '#2D6B43',
					800: '#1E472D',
					900: '#0F2416'
				},
				'hub-yellow': {
					50: '#FCF5E8',
					100: '#F9EBD1',
					200: '#F3D7A3',
					300: '#EDC375',
					400: '#E9B547',
					500: '#E6A324', // brand-yellow
					600: '#B8821D',
					700: '#8A6216',
					800: '#5C410F',
					900: '#2E2107'
				},
				'hub-red': {
					50: '#F5E8E8',
					100: '#EBD1D1',
					200: '#D7A3A3',
					300: '#C37575',
					400: '#B74747',
					500: '#A62524', // brand-red
					600: '#851E1D',
					700: '#641616',
					800: '#420F0F',
					900: '#210707'
				}
			}
		}
	},
	plugins: [],
	safelist: [
		'bg-theme-navbar',
		'bg-theme-button-1',
		'bg-theme-button-2',
		'bg-theme-button-3',
		'bg-theme-button-4',
		'bg-theme-button-5',
		'bg-theme-panel-head-1',
		'bg-theme-panel-head-2',
		'bg-theme-panel-head-3',
		'text-theme-button-1',
		'text-theme-button-2',
		'border-theme-button-1',
		'border-theme-button-2',
		'focus:ring-theme-button-1',
		'focus:ring-theme-button-2',
		'focus:border-theme-button-1',
		'focus:border-theme-button-2'
	]
};

