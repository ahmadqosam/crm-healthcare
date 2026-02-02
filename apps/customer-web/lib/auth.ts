import Cookies from 'js-cookie';

export const TOKEN_KEY = 'crm_auth_token';
export const REFRESH_TOKEN_KEY = 'crm_refresh_token';

export const setToken = (token: string) => {
    Cookies.set(TOKEN_KEY, token, { expires: 1 / 24 / 4 }); // Access token, expires in 15m (approx)
};

export const setRefreshToken = (token: string) => {
    Cookies.set(REFRESH_TOKEN_KEY, token, { expires: 7 }); // Refresh token, 7 days
};

export const getToken = () => {
    return Cookies.get(TOKEN_KEY);
};

export const getRefreshToken = () => {
    return Cookies.get(REFRESH_TOKEN_KEY);
};

export const removeToken = () => {
    Cookies.remove(TOKEN_KEY);
    Cookies.remove(REFRESH_TOKEN_KEY);
};

export const isAuthenticated = () => {
    return !!getToken();
};
