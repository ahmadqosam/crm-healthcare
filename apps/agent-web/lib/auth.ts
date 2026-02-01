import Cookies from 'js-cookie';

export const TOKEN_KEY = 'crm_agent_auth_token';

export const setToken = (token: string) => {
    Cookies.set(TOKEN_KEY, token, { expires: 1 });
};

export const getToken = () => {
    return Cookies.get(TOKEN_KEY);
};

export const removeToken = () => {
    Cookies.remove(TOKEN_KEY);
};

export const isAuthenticated = () => {
    return !!getToken();
};
